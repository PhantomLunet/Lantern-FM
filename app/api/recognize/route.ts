import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { status: 'error', error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const apiToken = process.env.AUDD_API_TOKEN;

    if (!apiToken) {
      // Demo mode — no API key configured
      return NextResponse.json({
        status: 'demo',
        result: null,
        message:
          'Song recognition is not configured. Set the AUDD_API_TOKEN environment variable to enable real song identification. Get a free key at https://audd.io/',
      });
    }

    // Forward the audio to AudD for recognition
    const auddForm = new FormData();
    auddForm.append('file', audioFile);
    auddForm.append('api_token', apiToken);
    auddForm.append('return', 'apple_music,spotify');

    const response = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: auddForm,
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: 'error', error: 'Recognition service returned an error' },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (data.status === 'success' && data.result) {
      return NextResponse.json({
        status: 'success',
        result: {
          title: data.result.title || 'Unknown Title',
          artist: data.result.artist || 'Unknown Artist',
          album: data.result.album || null,
          releaseDate: data.result.release_date || null,
          spotify: data.result.spotify?.external_urls?.spotify || null,
          appleMusic: data.result.apple_music?.url || null,
        },
      });
    }

    // No match found
    return NextResponse.json({
      status: 'no_match',
      result: null,
      message: 'Could not identify the song. Try again with a clearer audio sample.',
    });
  } catch (error) {
    console.error('[recognize] Error:', error);
    return NextResponse.json(
      { status: 'error', error: 'Internal server error during recognition' },
      { status: 500 }
    );
  }
}
