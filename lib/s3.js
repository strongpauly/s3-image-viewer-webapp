const awskey = process.env.AWS_ACCESS_KEY_ID || '';
const awssecretkey = process.env.AWS_SECRET_ACCESS_KEY || '';
const awsregion = process.env.AWS_REGION || 'us-east-1';
const { S3Client } = require('@aws-sdk/client-s3');

const config = { region: awsregion };
if(awskey && awssecretkey) {
  config.credentials = { accessKeyId: awskey, secretAccessKey: awssecretkey };
}
module.exports = {
    s3: new S3Client(config),
    awsregion
}