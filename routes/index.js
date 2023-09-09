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
function buildFileListFromS3Data(bucketname, folder, raw) {
    const S3_PREFIX = `https://${bucketname}.s3.${awsregion}.amazonaws.com/`;
    console.log({folder, raw})
    const files = [];
    for (const key of raw.files) {
        let prefixWithinFolder = key
        if(folder) {
           prefixWithinFolder = key.substring(folder.length + 1);
        }
        console.log({key, prefixWithinFolder})
        if(prefixWithinFolder) {
          files.push(`${S3_PREFIX}${key}`);
        }
    }
    const folders = [];
    for (const prefix of raw.folders) {
      let fld = prefix.substring(folder.length);
      if(fld.startsWith("/")) {
        fld = fld.substring(1)
      }
      if(fld.endsWith("/")) {
        fld = fld.substring(0, fld.length -1)
      }
      folders.push(fld)
    }
    return {files, folders};
}

async function listOjects(bucketName, folderPath) {
  const params = {
    Bucket: bucketName,
    Delimiter: '/',
    Prefix: folderPath ? `${folderPath}/` : folderPath, // Folder path ends with '/'
  };

  const folders = [];
  const files = []

  let continuationToken = null;

  do {
    if (continuationToken) {
      params.ContinuationToken = continuationToken;
    }

    const response = await s3.listObjectsV2(params).promise();

    // Extract and add folder names to the array
    response.CommonPrefixes.forEach((commonPrefix) => {
      folders.push(commonPrefix.Prefix);
    });

    // Add file keys to the array
    response.Contents.forEach((content) => {
      files.push(content.Key);
    });

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return {files, folders};
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
    const {files, folders} = buildFileListFromS3Data(bucket, folder, await listOjects(bucket, folder));
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
