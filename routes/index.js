const express = require('express');
const sharp = require('sharp');
const AWS = require('aws-sdk');
const router = express.Router();
const { existsSync } = require('fs');
const { mkdir } = require('fs/promises')
const {join} = require('path')


require('dotenv').config()
const awskey = process.env.AWS_ACCESS_KEY_ID || '';
const awssecretkey = process.env.AWS_SECRET_ACCESS_KEY || '';
const awsregion = process.env.AWS_REGION || 'us-east-1';

const bucketIds = JSON.parse(process.env.BUCKETS || '[]');
if(awskey && awssecretkey && awsregion) {
  AWS.config.update({accessKeyId: awskey, secretAccessKey: awssecretkey, region: awsregion});
}
const s3 = new AWS.S3();

const IMAGE_EXTENSIONS = new Set(JSON.parse(process.env.IMAGE_EXTENSIONS || '["apng","avif","gif","jpg","jpeg","jfif","pjpeg","pjp","png","svg","webp"]'));
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '0')

async function upsertThumbnail(bucketname, key, tag, url) {
    try {
      const fileName = `${key.split("/").pop()}.webp`
      const path = `thumbnails/${bucketname}/${(key)}/${tag.replace(/"/g,'')}/${fileName}`
      const directory = join(__dirname, `../public/${path}`)
      const thumbnailFile = `${directory}/${fileName}`;
      const thumbnailUrl = `/${path}/${fileName}`
      if (existsSync(thumbnailFile)) {
        return thumbnailUrl;
      }
      await mkdir(directory, {recursive: true})
      const object = await s3.getObject({
        Bucket: bucketname,
        Key: key
      }).promise()
      await sharp(object.Body).resize({height: 600}).toFile(thumbnailFile);
      return thumbnailUrl;
    } catch (ex) {
      console.error(ex)
      return url
    }
}

//----------------------------------------------------------------------------
// validate the images and filter them according to prefs
//----------------------------------------------------------------------------
function filterImages(data) {
    return data.filter(({originalUrl}) => IMAGE_EXTENSIONS.has(originalUrl.split('.').pop()));
}

//----------------------------------------------------------------------------
// loop through S3 formatted API results and build an images list
//----------------------------------------------------------------------------
async function buildFileListFromS3Data(bucketname, folder, raw) {
    const S3_PREFIX = `https://${bucketname}.s3.${awsregion}.amazonaws.com/`;
    const files = [];
    for (const { Size, Key, ETag } of raw.files) {
        const originalUrl = `${S3_PREFIX}${Key}`;
        let url = originalUrl;
        let prefixWithinFolder = Key
        if(folder) {
           prefixWithinFolder = Key.substring(folder.length + 1);
        }
        if(!prefixWithinFolder) {
          continue;
        }
        if(MAX_IMAGE_SIZE && Size > MAX_IMAGE_SIZE) {
          console.log(`Creating thumbnail for ${Key} - ${Size}`);
          url = await upsertThumbnail(bucketname, Key, ETag, originalUrl)
        } 
        files.push({url, originalUrl});
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
      files.push(content);
    });

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return { files, folders };
}


router.get('/', function (_req, res, _next){
  const bucket = bucketIds[0] || fakeBucket;
  console.log('loading bucket: ' + bucket);
  res.redirect(`/${bucket}/`)
})


//----------------------------------------------------------------------------
// GET on the main page.
//----------------------------------------------------------------------------
router.get('/:bucket', async function(req, res) {
  const { bucket } = req.params;
  const { folder = '' } = req.query;
  if (!bucket) { 
    res.sendStatus(400);
    return;
  }
  // query for images
  console.log(`querying S3 for objects in ${bucket}/${folder}`);
  try {
    const {files, folders} = await buildFileListFromS3Data(bucket, folder, await listOjects(bucket, folder));
    filteredImagesArray = filterImages(files);
    res.render('index', { title: 'AWS S3 Image Viewer', showBucket: bucket, images: JSON.stringify(filteredImagesArray), buckets: JSON.stringify(bucketIds), folder, folders: JSON.stringify(folders)});
  } catch (err) {
    console.error(err, err.stack); // an error occurred
    res.render('index', { title: 'AWS S3 Image Viewer', showBucket: bucket, images: '[]', buckets: JSON.stringify(bucketIds)});
  }
});


router.get('/:bucket', function (req, res, next){
  const bucket = req.params.bucket;
  res.redirect(`/${bucket}/*`)
})

module.exports = router;
