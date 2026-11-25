export const messagingExtensionIds = [];

export const messagingExtensionTestRoots = [];

export function isMessagingExtensionRoot(root) {
  return messagingExtensionTestRoots.includes(root);
}
