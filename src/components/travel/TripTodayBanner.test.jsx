import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TripTodayBanner from './TripTodayBanner';

const days = [
  {
    _key: 'd1',
    day_index: 1,
    date: '2026-09-25',
    title: '大阪落地 → 心斋桥/道顿堀',
    lodging: '大阪日航酒店',
    notes: '南海 Rapi:t 到难波',
  },
  {
    _key: 'd2',
    day_index: 2,
    date: '2026-09-26',
    title: '大阪市区打卡 + 购物',
    lodging: '大阪日航酒店',
    notes: '心斋桥全程步行',
  },
];

describe('TripTodayBanner', () => {
  it('shows today\'s itinerary and can switch days', () => {
    render(<TripTodayBanner days={days} startDate="2026-09-25" today="2026-09-26" />);
    expect(screen.getByText('大阪市区打卡 + 购物')).toBeInTheDocument();
    expect(screen.getByText('心斋桥全程步行')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /DAY 1/i }));
    expect(screen.getByText('大阪落地 → 心斋桥/道顿堀')).toBeInTheDocument();
  });
});
