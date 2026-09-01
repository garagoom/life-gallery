// Static fallback data (used when backend is offline)
export const fallbackPhotos = [
  {
    id: 1,
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    title: 'Mountain Sunrise',
    date: '2024-03-15',
    category: 'landscape',
    rotation: -2
  },
  {
    id: 2,
    src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
    title: 'Portrait Study',
    date: '2024-04-20',
    category: 'portrait',
    rotation: 1
  },
  {
    id: 3,
    src: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800',
    title: 'City Streets',
    date: '2024-05-10',
    category: 'street',
    rotation: -1
  },
  {
    id: 4,
    src: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800',
    title: 'Golden Hour',
    date: '2024-06-05',
    category: 'landscape',
    rotation: 2
  },
  {
    id: 5,
    src: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800',
    title: 'Urban Life',
    date: '2024-07-12',
    category: 'street',
    rotation: -3
  },
  {
    id: 6,
    src: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
    title: 'Nature Path',
    date: '2024-08-01',
    category: 'landscape',
    rotation: 1
  }
];

// Helper to get photo URL
export function getPhotoUrl(photo) {
  if (photo.filename) {
    return `/uploads/${photo.filename}`;
  }
  return photo.src;
}

// Helper to get thumbnail URL
export function getThumbnailUrl(photo) {
  if (photo.thumbnail) {
    return `/thumbnails/${photo.thumbnail}`;
  }
  return photo.src;
}

// Helper to get camera info string
export function getCameraInfo(photo) {
  const parts = [];
  if (photo.camera_make) parts.push(photo.camera_make);
  if (photo.camera_model) parts.push(photo.camera_model);
  return parts.length > 0 ? parts.join(' ') : null;
}

// Helper to get exposure settings string
export function getExposureSettings(photo) {
  const parts = [];
  if (photo.f_number) parts.push(photo.f_number);
  if (photo.exposure_time) parts.push(photo.exposure_time);
  if (photo.iso) parts.push(photo.iso);
  if (photo.focal_length) parts.push(photo.focal_length);
  return parts.length > 0 ? parts.join(' | ') : null;
}

export function getShuffledPhotos() {
  return [...fallbackPhotos].sort(() => Math.random() - 0.5);
}

export function getPhotosByCategory(category) {
  return fallbackPhotos.filter(photo => photo.category === category);
}

export function getRandomPhoto(excludeId = null) {
  const available = excludeId 
    ? fallbackPhotos.filter(p => p.id !== excludeId)
    : fallbackPhotos;
  return available[Math.floor(Math.random() * available.length)];
}
