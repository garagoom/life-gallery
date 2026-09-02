import { useState, useCallback } from 'react';
import { Modal } from 'antd';
import Cropper from 'react-easy-crop';

function getCroppedImg(imageSrc, pixelCrop) {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y,
        pixelCrop.width, pixelCrop.height,
        0, 0,
        pixelCrop.width, pixelCrop.height
      );
      canvas.toBlob((blob) => {
        resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.9);
    };
  });
}

export default function AvatarCropper({ open, imageSrc, onCrop, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropComplete = useCallback((_, area) => {
    setCroppedAreaPixels(area);
  }, []);

  const handleOk = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    const file = await getCroppedImg(imageSrc, croppedAreaPixels);
    onCrop(file);
  };

  return (
    <Modal
      title="裁剪头像"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="确定"
      cancelText="取消"
      width={400}
      destroyOnClose
    >
      <div style={{ position: 'relative', width: '100%', height: 300, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
        {imageSrc && (
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        )}
      </div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>缩放：</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ width: 200, verticalAlign: 'middle' }}
        />
      </div>
    </Modal>
  );
}
