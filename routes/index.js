const express = require('express');
const sharp = require('sharp');
const router = express.Router();
const {environment} = require('../lib/environment')
const {s3, awsregion} = require('../lib/s3')

const bucketIds = JSON.parse(process.env.BUCKETS || '[]');
const IMAGE_EXTENSIONS = new Set(JSON.parse(process.env.IMAGE_EXTENSIONS || '["apng","avif","gif","jpg","jpeg","jfif","pjpeg","pjp","png","svg","webp"]'));

function getThumbnailUrl(bucketname, key, tag) {
    const parts = key.split("/");
    const fileName = `${parts.pop()}.webp`;
    return `thumbnails/${bucketname}/${parts.join("/")}/${tag.replace(/"/g,'')}/${fileName}`
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
        if(environment.maxImageSize && Size > environment.maxImageSize) {
          console.log(`Creating thumbnail for ${Key} - ${Size}`);
          url = getThumbnailUrl(bucketname, Key, ETag, originalUrl)
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
    return {files, folders: folders.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))};
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
