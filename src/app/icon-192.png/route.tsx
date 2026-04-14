import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #8BAF9A 0%, #9B8FC4 100%)',
          borderRadius: '22%',
        }}
      >
        <div
          style={{
            color: '#F5F0E8',
            fontSize: 100,
            fontWeight: 'bold',
            lineHeight: 1,
            marginTop: -4,
          }}
        >
          ✦
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
