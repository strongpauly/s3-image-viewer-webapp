const express = require('express');
const router = express.Router();
require('dotenv').config()
const awskey = process.env.AWS_ACCESS_KEY_ID || '';
const awssecretkey = process.env.AWS_SECRET_ACCESS_KEY || '';
const awsregion = process.env.AWS_REGION || 'us-east-1';

const bucketIds = JSON.parse(process.env.BUCKETS || '[]');
const fakeBucket = 'FakeBucket';
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
function buildImagesListFromS3Data(bucketname, data) {
    const S3_PREFIX = `https://${bucketname}.s3.${awsregion}.amazonaws.com/`;
    const images = [];
    const contents = data.Contents
    //console.log("iterating " + JSON.stringify(contents));
    for (const iter in contents) {
        // any validation of key can go here
        //console.log("adding " + S3_PREFIX + contents[iter].Key)
        images.push(S3_PREFIX + contents[iter].Key);
    }
    return images;
}

//----------------------------------------------------------------------------
// GET on the main page.
//----------------------------------------------------------------------------
router.get('/', function(req, res, next) {

  let imagesArray = [];
  let showBucket = req.query.showBucket;
  if (!showBucket) { 
    console.log('no bucket, forcing to first bucket');
    showBucket = bucketIds[0] || fakeBucket
  }
  console.log('loading bucket: ' + showBucket);

  // for DEBUGGING
  if (showBucket === fakeBucket) {
    imagesArray = ['https://s3.amazonaws.com/rhdj2017-selfie-in/59bc8771815ba5440626d40d-59bc87725d92c77569d4ddc1.png',
                 'https://s3.amazonaws.com/rhdj2017-selfie-in/59bc8771815ba5440626d40d-59bc87725d92c77569d4ddc1.png',
                 'https://s3.amazonaws.com/rhdj2017-selfie-in/59bc8771815ba5440626d40d-59bc87725d92c77569d4ddc1.png',
                 'https://s3.amazonaws.com/rhdj2017-selfie-in/59bc8771815ba5440626d40d-59bc87725d92c77569d4ddc1.png'];
    res.render('index', { title: 'AWS S3 Image Viewer', showBucket: showBucket, images: JSON.stringify(imagesArray), buckets: JSON.stringify(bucketIds)});
  } else {
    // query for images
    console.log('querying S3 for objects in ' + showBucket);
    const params = {
      Bucket: showBucket
      //ContinuationToken: 'STRING_VALUE',
      //Delimiter: 'STRING_VALUE',
      //EncodingType: url,
      //FetchOwner: false,
      //MaxKeys: 50,
      //Prefix: 'STRING_VALUE',
      //RequestPayer: requester,
      //StartAfter: 'STRING_VALUE'
    };
    s3.listObjectsV2(params, function(err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
        res.render('index', { title: 'AWS S3 Image Viewer', showBucket: showBucket, images: JSON.stringify(imagesArray), buckets: JSON.stringify(bucketIds)});
      } else {
        //console.log(data);
        imagesArray = buildImagesListFromS3Data(showBucket, data);
        filteredImagesArray = filterImages(imagesArray);
        res.render('index', { title: 'AWS S3 Image Viewer', showBucket: showBucket, images: JSON.stringify(filteredImagesArray), buckets: JSON.stringify(bucketIds)});
      }
    });
  }
});

module.exports = router;
