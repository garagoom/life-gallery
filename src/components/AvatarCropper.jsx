import { useState, useRef, useEffect } from 'react';
import { Modal } from 'antd';

export default function AvatarCropper({ open, imageSrc, onCrop, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const draw = (z, o) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight) * z;
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const x = (size - drawW) / 2 + o.x;
    const y = (size - drawH) / 2 + o.y;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y, drawW, drawH);
  };

  useEffect(() => {
    if (!imageSrc || !open) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      requestAnimationFrame(() => draw(1, { x: 0, y: 0 }));
    };
    img.src = imageSrc;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [imageSrc, open]);

  useEffect(() => { draw(zoom, offset); }, [zoom, offset]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const newOffset = { x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y };
    setOffset(newOffset);
  };

  const handleMouseUp = () => setDragging(false);

  const handleOk = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onCrop(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  return (
    <Modal
      title="裁剪头像"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="确定"
      cancelText="取消"
      width={360}
      destroyOnClose
    >
      <div style={{
        width: 256, height: 256, margin: '0 auto', borderRadius: '50%',
        overflow: 'hidden', background: '#000', cursor: dragging ? 'grabbing' : 'grab',
        border: '3px solid var(--border)',
      }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} style={{ width: 256, height: 256, display: 'block' }} />
      </div>
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 8 }}>缩放</span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          style={{ width: 180, verticalAlign: 'middle' }}
        />
      </div>
      <div style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
        拖动图片调整位置，滑块调整大小
      </div>
    </Modal>
  );
}
