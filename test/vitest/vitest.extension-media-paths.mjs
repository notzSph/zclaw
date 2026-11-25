export const mediaExtensionTestRoots = [
  "extensions/elevenlabs",
  "extensions/image-generation-core",
  "extensions/media-understanding-core",
  "extensions/video-generation-core",
];

export function isMediaExtensionRoot(root) {
  return mediaExtensionTestRoots.includes(root);
}
