export function buildDataUrl(profileImage: string, backendUrl?: string): string {
  if (!profileImage) return '';
  if (profileImage.startsWith('http')) return profileImage;
  return backendUrl ? `${backendUrl}/dweb-0/data/${profileImage}` : `/dweb-0/data/${profileImage}`;
}


