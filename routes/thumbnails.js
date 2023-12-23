var express = require('express');
var router = express.Router();
const sharp = require('sharp');
const { existsSync } = require('fs');
const { mkdir, readFile } = require('fs/promises')
const { join } = require('path')
const { s3 } = require('../lib/s3')

async function upsertThumbnail(path) {
    try {
      const parts = path.split('/');
      const fileName = parts.pop();
      const directory = join(__dirname, `../thumbnails/${parts.join("/")}`)
      const thumbnailFile = `${directory}/${fileName}`
      if (existsSync(thumbnailFile)) {
        return await readFile(thumbnailFile);
      }
      const bucketname = parts.shift();
      parts.pop(); // Remove tag
      const key = `${parts.join("/")}${parts.length > 0 ? '/':''}${decodeURIComponent(fileName.substring(0, fileName.length - 5))}`
      console.log(`Downloading ${key} from ${bucketname}`)
      await mkdir(directory, {recursive: true})
      const object = await s3.getObject({
        Bucket: bucketname,
        Key: key
      }).promise()
      const resized = sharp(object.Body).resize({height: 600})
      await resized.toFile(thumbnailFile);
      return await resized.toBuffer();
    } catch (ex) {
      console.error(`Upserting thumbnail '${path}'`)
      console.error(ex)
      return ''
    }
}


router.get('/*', async function(req, res, next) {
  res.send(await upsertThumbnail(decodeURI(req.path.substring(1))))
    
});

module.exports = router;