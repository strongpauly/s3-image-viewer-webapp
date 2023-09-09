require('dotenv').config()

module.exports = {
    environment: {
        maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE || '0')
    }
}