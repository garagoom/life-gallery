import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CloudOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  AimOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getGlowForecast, searchGlowPlaces } from '../api/glow';
import styles from './GlowForecast.module.css';

const { Title, Text, Paragraph } = Typography;

const STORAGE_KEY = 'life-gallery:glow-place';

const DEFAULT_PLACE = {
  label: '上海',
  value: '上海|31.2304,121.4737',
  lat: 31.2304,
  lng: 121.4737,
};

const PRESET_CHIPS = [
  '上海', '北京', '杭州', '成都', '厦门', '大理', '丽江', '青岛', '三亚', '东京', '大阪', '清迈',
];

const FACTOR_LABELS = {
  highCloud: '高云',
  midCloud: '中云',
  lowCloud: '低云通透',
  totalCloud: '总云量',
  visibility: '能见度',
  humidity: '湿度',
  precip: '降水',
};

function readStoredPlace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLACE;
    const parsed = JSON.parse(raw);
    const lat = Number(parsed?.lat);
    const lng = Number(parsed?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return DEFAULT_PLACE;
    return {
      label: String(parsed.label || '已选位置'),
      value: String(parsed.value || `${parsed.label}|${lat},${lng}`),
      lat,
      lng,
    };
  } catch {
    return DEFAULT_PLACE;
  }
}

function persistPlace(place) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      label: place.label,
      value: place.value,
      lat: place.lat,
      lng: place.lng,
    }));
  } catch {
    // ignore quota / private mode
  }
}

function toOption(row) {
  return {
    label: row.label,
    value: row.value,
    lat: row.lat,
    lng: row.lng,
  };
}

function resolvePlace(value, option) {
  const lat = Number(option?.lat);
  const lng = Number(option?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      label: option.label || String(value),
      value: String(value),
      lat,
      lng,
    };
  }
  const str = String(value || '');
  const idx = str.lastIndexOf('|');
  if (idx > 0) {
    const [a, b] = str.slice(idx + 1).split(',').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return {
        label: str.slice(0, idx),
        value: str,
        lat: a,
        lng: b,
      };
    }
  }
  return null;
}

function formatRange(start, end) {
  if (!start || !end) return '—';
  const a = dayjs(start);
  const b = dayjs(end);
  if (!a.isValid() || !b.isValid()) return '—';
  return `${a.format('M月D日 HH:mm')} – ${b.format('HH:mm')}`;
}

function formatSun(iso, kind) {
  if (!iso) return '—';
  const d = dayjs(iso);
  if (!d.isValid()) return '—';
  return `${kind === 'evening' ? '日落' : '日出'} ${d.format('M月D日 HH:mm')}`;
}

function GlowCard({ data }) {
  if (!data) return null;
  const level = data.level || {};
  const factors = data.factors || {};

  return (
    <Card className={styles.glowCard} bordered={false}>
      <div className={styles.cardHead}>
        <div>
          <Title level={4} className={styles.cardTitle}>{data.label}</Title>
          <Text type="secondary">{formatSun(data.sunAt, data.kind)}</Text>
        </div>
        <Tag color={level.color || 'default'} className={styles.levelTag}>
          {level.label || '—'}
        </Tag>
      </div>

      {data.past && (
        <Alert
          type="info"
          showIcon
          className={styles.pastAlert}
          message="今晚窗口已过，分数供回顾；明早仍可参考。"
        />
      )}

      <div className={styles.scoreBlock}>
        <Progress
          type="dashboard"
          percent={data.score || 0}
          strokeColor={{
            '0%': '#8b7355',
            '100%': '#e87a3a',
          }}
          format={(p) => (
            <span className={styles.scoreText}>
              <strong>{p}</strong>
              <small>分</small>
            </span>
          )}
        />
        <div className={styles.windowMeta}>
          <Text type="secondary">建议关注</Text>
          <div>{formatRange(data.start, data.end)}</div>
        </div>
      </div>

      <div className={styles.factorList}>
        {Object.keys(FACTOR_LABELS).map((key) => (
          <div key={key} className={styles.factorRow}>
            <span>{FACTOR_LABELS[key]}</span>
            <Progress
              percent={Number(factors[key]) || 0}
              size="small"
              showInfo
              strokeColor="#b8a080"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function GlowForecast() {
  const [place, setPlace] = useState(readStoredPlace);
  const [options, setOptions] = useState(() => [toOption(readStoredPlace())]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const timerRef = useRef(null);
  const seqRef = useRef(0);

  const rememberPlace = useCallback((next) => {
    setPlace(next);
    persistPlace(next);
    setOptions((prev) => {
      const exists = prev.some((item) => item.value === next.value);
      return exists ? prev : [toOption(next), ...prev].slice(0, 20);
    });
  }, []);

  const load = useCallback(async (next = place) => {
    setLoading(true);
    setError('');
    try {
      const result = await getGlowForecast({ lat: next.lat, lng: next.lng });
      setData(result);
    } catch (err) {
      setData(null);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [place]);

  useEffect(() => {
    load(place);
    searchGlowPlaces('')
      .then((rows) => {
        const mapped = (rows || []).map(toOption);
        setOptions((prev) => {
          const map = new Map();
          [toOption(place), ...mapped, ...prev].forEach((item) => {
            if (item?.value) map.set(item.value, item);
          });
          return Array.from(map.values()).slice(0, 24);
        });
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 仅首屏

  const selectPlace = (next) => {
    rememberPlace(next);
    load(next);
  };

  const handleSearch = (raw) => {
    const query = String(raw || '').trim();
    window.clearTimeout(timerRef.current);
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    timerRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await searchGlowPlaces(query);
        if (seqRef.current !== seq) return;
        setOptions((rows || []).map(toOption));
      } catch {
        if (seqRef.current !== seq) return;
        message.warning('地点搜索失败');
      } finally {
        if (seqRef.current === seq) setSearching(false);
      }
    }, 280);
  };

  const handleSelect = (value, option) => {
    const fromList = options.find((item) => item.value === value);
    const next = resolvePlace(value, { ...fromList, ...option });
    if (!next) {
      message.warning('该地点缺少坐标');
      return;
    }
    selectPlace(next);
  };

  const pickChip = async (name) => {
    const hit = options.find((item) => item.label === name || String(item.label).endsWith(name));
    if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) {
      selectPlace(hit);
      return;
    }
    setSearching(true);
    try {
      const rows = await searchGlowPlaces(name);
      const mapped = (rows || []).map(toOption);
      setOptions(mapped);
      const exact = mapped.find((item) => item.label === name)
        || mapped.find((item) => String(item.label).includes(name));
      if (!exact) {
        message.warning(`未找到「${name}」`);
        return;
      }
      selectPlace(exact);
    } catch {
      message.warning('地点搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const useGeolocation = () => {
    if (!navigator.geolocation) {
      message.warning('当前浏览器不支持定位');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e4) / 1e4;
        const lng = Math.round(pos.coords.longitude * 1e4) / 1e4;
        const next = {
          label: '当前位置',
          value: `当前位置|${lat},${lng}`,
          lat,
          lng,
        };
        setLocating(false);
        selectPlace(next);
      },
      () => {
        setLocating(false);
        message.warning('定位失败，仍使用当前地点');
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <Title level={2} className={styles.title}>
            <CloudOutlined /> 火烧云
          </Title>
          <Paragraph type="secondary" className={styles.subtitle}>
            免费预报 · 今晚晚霞 / 明早朝霞 · 仅供参考
          </Paragraph>
        </div>
        <Space wrap>
          <Button icon={<AimOutlined />} loading={locating} onClick={useGeolocation}>
            使用定位
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(place)}>
            刷新
          </Button>
        </Space>
      </header>

      <Card className={styles.locationCard} size="small">
        <div className={styles.locationRow}>
          <EnvironmentOutlined className={styles.locationIcon} />
          <Select
            showSearch
            allowClear={false}
            filterOption={false}
            loading={searching}
            value={place.value}
            options={options}
            placeholder="搜索城市 / 地名，如上海、大阪"
            notFoundContent={searching ? '搜索中…' : '输入地名搜索'}
            onSearch={handleSearch}
            onSelect={handleSelect}
            optionLabelProp="label"
            className={styles.placeSelect}
            popupMatchSelectWidth={false}
          />
        </div>
        <div className={styles.chipRow}>
          {PRESET_CHIPS.map((name) => (
            <button
              key={name}
              type="button"
              className={`${styles.chip} ${place.label === name || String(place.label).endsWith(name) ? styles.chipActive : ''}`}
              onClick={() => pickChip(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <Text type="secondary" className={styles.coordHint}>
          {place.label} · {place.lat}, {place.lng}
        </Text>
      </Card>

      {error && (
        <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
      )}

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <GlowCard data={data?.evening} />
          </Col>
          <Col xs={24} md={12}>
            <GlowCard data={data?.morning} />
          </Col>
        </Row>
      </Spin>

      <Alert
        className={styles.disclaimer}
        type="warning"
        showIcon
        message={data?.disclaimer || '预测仅供参考，实际观感受局地天气与视野遮挡影响。'}
        description="数据来源：Open-Meteo 免费气象与地理编码。高/中云有利、低云与降水不利；不等于保证出片。"
      />
    </div>
  );
}
