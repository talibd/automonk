const { Client } = require('minio');
const env = require('../config/env');
const logger = require('../utils/logger');

const storage = new Client({
  endPoint: env.storage.endpoint,
  port: env.storage.port,
  useSSL: env.storage.use_ssl,
  accessKey: env.storage.access_key,
  secretKey: env.storage.secret_key,
});

async function ensureStorageBucket() {
  const exists = await storage.bucketExists(env.storage.bucket);
  if (!exists) {
    await storage.makeBucket(env.storage.bucket);
    logger.info('Storage bucket created', { bucket: env.storage.bucket });
  }
}

async function uploadPng(buffer, objectName) {
  await storage.putObject(env.storage.bucket, objectName, buffer, buffer.length, {
    'Content-Type': 'image/png',
  });

  return buildPublicUrl(objectName);
}

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
  return storage.getObject(env.storage.bucket, objectName);
}

async function statObject(objectName) {
  return storage.statObject(env.storage.bucket, objectName);
}

module.exports = {
  storage,
  ensureStorageBucket,
  uploadPng,
  uploadSlides,
  buildPublicUrl,
  getObject,
  statObject,
};
