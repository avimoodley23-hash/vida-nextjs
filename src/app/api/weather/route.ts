import { NextResponse } from 'next/server';
import { getWeather } from '@/lib/weather';

export async function GET() {
  const weather = await getWeather();
  if (!weather) {
    return NextResponse.json({ error: 'Weather unavailable' }, { status: 503 });
  }
  return NextResponse.json(weather);
}
