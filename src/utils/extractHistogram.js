import { extractImageAnalysis, lumaValue } from './extractImageAnalysis';

export { lumaValue };

export function extractHistogram(img) {
  return extractImageAnalysis(img).histogram;
}
