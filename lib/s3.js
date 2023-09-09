const awskey = process.env.AWS_ACCESS_KEY_ID || '';
const awssecretkey = process.env.AWS_SECRET_ACCESS_KEY || '';
const awsregion = process.env.AWS_REGION || 'us-east-1';
const AWS = require('aws-sdk');
if(awskey && awssecretkey && awsregion) {
  AWS.config.update({accessKeyId: awskey, secretAccessKey: awssecretkey, region: awsregion});
}
module.exports = {
    s3: new AWS.S3(),
    awsregion
}