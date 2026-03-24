const { Client } = require('minio');
const env = require('../config/env');
const logger = require('../utils/logger');

const minio = new Client({
  endPoint: env.minio.endpoint,
  port: env.minio.port,
  useSSL: env.minio.use_ssl,
  accessKey: env.minio.access_key,
  secretKey: env.minio.secret_key,
});

/**
 * Ensure the automonk bucket exists. Called once at startup.
 */
async function ensureBucket() {
  const exists = await minio.bucketExists(env.minio.bucket);
  if (!exists) {
    await minio.makeBucket(env.minio.bucket);
    logger.info('MinIO bucket created', { bucket: env.minio.bucket });
  }
}

/**
 * Upload a PNG buffer and return a public URL.
 * @param {Buffer} buffer
 * @param {string} objectName  - e.g. "clients/1/posts/42/instagram/slide_01.png"
 * @returns {Promise<string>}  - URL to the stored file
 */
async function uploadPng(buffer, objectName) {
  await minio.putObject(env.minio.bucket, objectName, buffer, buffer.length, {
    'Content-Type': 'image/png',
  });

  return buildPublicUrl(objectName);
}

/**
 * Upload all slide PNG buffers for a post variant.
 * @param {Buffer[]} buffers
 * @param {number} clientId
 * @param {number} postId
 * @param {string} platform
 * @returns {Promise<string[]>} ordered array of URLs
 */
async function uploadSlides(buffers, clientId, postId, platform) {
  const urls = [];
  for (let i = 0; i < buffers.length; i++) {
    const objectName = `clients/${clientId}/posts/${postId}/${platform}/slide_${String(i + 1).padStart(2, '0')}.png`;
    const url = await uploadPng(buffers[i], objectName);
    urls.push(url);
  }
  return urls;
}

function buildPublicUrl(objectName) {
  const safePath = objectName.split('/').map(encodeURIComponent).join('/');
  return `${env.app_url}/media/${safePath}`;
}

async function getObject(objectName) {
  return minio.getObject(env.minio.bucket, objectName);
}

async function statObject(objectName) {
  return minio.statObject(env.minio.bucket, objectName);
}

module.exports = { minio, ensureBucket, uploadPng, uploadSlides, buildPublicUrl, getObject, statObject };
