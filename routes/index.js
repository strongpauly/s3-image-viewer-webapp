const express = require('express');
const router = express.Router();
require('dotenv').config()
const awskey = process.env.AWS_ACCESS_KEY_ID || '';
const awssecretkey = process.env.AWS_SECRET_ACCESS_KEY || '';
const awsregion = process.env.AWS_REGION || 'us-east-1';

const bucketIds = JSON.parse(process.env.BUCKETS || '[]');
const AWS = require('aws-sdk');
if(awskey && awssecretkey && awsregion) {
  AWS.config.update({accessKeyId: awskey, secretAccessKey: awssecretkey, region: awsregion});
}
const s3 = new AWS.S3();

const IMAGE_EXTENSIONS = new Set(JSON.parse(process.env.IMAGE_EXTENSIONS || '["apng","avif","gif","jpg","jpeg","jfif","pjpeg","pjp","png","svg","webp"]'));

//----------------------------------------------------------------------------
// validate the images and filter them according to prefs
//----------------------------------------------------------------------------
function filterImages(data) {
    return data.filter(img => IMAGE_EXTENSIONS.has(img.split('.').pop()));
}

//----------------------------------------------------------------------------
// loop through S3 formatted API results and build an images list
//----------------------------------------------------------------------------
function buildFileListFromS3Data(bucketname, folder, data) {
    const S3_PREFIX = `https://${bucketname}.s3.${awsregion}.amazonaws.com/`;
    const files = [];
    const folders = new Set()
    for (const iter in data) {
        const key = data[iter].Key;
        let prefixWithinFolder = key
        if(folder) {
           prefixWithinFolder = key.substring(folder.length + 1);
        }
        console.log({key, prefixWithinFolder})
        if(prefixWithinFolder.indexOf("/") === -1) {
          files.push(`${S3_PREFIX}${key}`);
        } else {
          const folder = prefixWithinFolder.split('/').shift();
          console.log({folder})
          folders.add(folder)
        }
    }
    return {files, folders: Array.from(folders)};
}

async function listObjects(bucket, folder) {
  let contents = [];
  let truncated = false;
  let continuationToken = undefined;
  do {
    data = await s3.listObjectsV2({
      Bucket: bucket,
      Prefix: folder,
      ContinuationToken: continuationToken
    }).promise();
    contents = contents.concat(data.Contents)
    truncated = data.IsTruncated;
    continuationToken = data.NextContinuationToken;
  } while (truncated)
  return contents;
}

router.get('/', function (_req, res, _next){
  const bucket = bucketIds[0] || fakeBucket;
  console.log('loading bucket: ' + bucket);
  res.redirect(`/${bucket}/`)
})


//----------------------------------------------------------------------------
// GET on the main page.
//----------------------------------------------------------------------------
router.get('/:bucket', async function(req, res, next) {
  const { bucket } = req.params;
  const { folder = '' } = req.query;
  if (!bucket) { 
    res.sendStatus(400);
    return;
  }
  // query for images
  console.log('querying S3 for objects in ' + bucket);
  try {
    const data = await listObjects(bucket, folder);
    const {files, folders} = buildFileListFromS3Data(bucket, folder, data);
    console.log({files, folders})
    filteredImagesArray = filterImages(files);
    res.render('index', { title: 'AWS S3 Image Viewer', showBucket: bucket, images: JSON.stringify(filteredImagesArray), buckets: JSON.stringify(bucketIds), folder, folders: JSON.stringify(folders)});
  } catch (err) {
    console.log(err, err.stack); // an error occurred
    res.render('index', { title: 'AWS S3 Image Viewer', showBucket: bucket, images: '[]', buckets: JSON.stringify(bucketIds)});
  }
});


router.get('/:bucket', function (req, res, next){
  const bucket = req.params.bucket;
  res.redirect(`/${bucket}/*`)
})

module.exports = router;
