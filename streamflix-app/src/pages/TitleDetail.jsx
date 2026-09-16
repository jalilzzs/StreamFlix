import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import VideoPlayer from '../components/VideoPlayer';

export default function TitleDetail() {
  const { id } = useParams();

  const [title, setTitle] =
    useState(null);

  const [episodes, setEpisodes] =
    useState([]);

  const [selectedSeason, setSelectedSeason] =
    useState(null);

  const [selectedEpisode, setSelectedEpisode] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [episodesLoading, setEpisodesLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function fetchRealData() {
      if (!id) return;

      try {
        setLoading(true);
        setError('');

        const {
          data,
          error: titleError,
        } = await supabase
          .from('titles')
          .select('*')
          .eq('id', id)
          .single();

        if (titleError) {
          throw titleError;
        }

        setTitle(data || null);
      } catch (err) {
        console.error(
          'خطأ في جلب البيانات:',
          err
        );

        setError(
          err?.message ||
            'تعذر جلب معلومات العمل'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchRealData();
  }, [id]);

  useEffect(() => {
    async function fetchEpisodes() {
      if (
        !title?.id ||
        !(
          title.type === 'series' ||
          title.type === 'tv'
        )
      ) {
        setEpisodes([]);
        return;
      }

      try {
        setEpisodesLoading(true);
        setError('');

        const {
          data,
          error: episodesError,
        } = await supabase
          .from('episodes')
          .select('*')
          .eq('title_id', title.id)
          .order('season', {
            ascending: true,
          })
          .order('episode_number', {
            ascending: true,
          });

        if (episodesError) {
          throw episodesError;
        }

        const result =
          data || [];

        setEpisodes(result);

        if (result.length) {
          const firstSeason =
            Number(
              result[0].season
            );

          const firstEpisode =
            result.find(
              (episode) =>
                Number(
                  episode.season
                ) === firstSeason
            ) || result[0];

          setSelectedSeason(
            firstSeason
          );

          setSelectedEpisode(
            firstEpisode
          );
        } else {
          setSelectedSeason(null);
          setSelectedEpisode(null);
        }
      } catch (err) {
        console.error(
          'خطأ في جلب الحلقات:',
          err
        );

        setError(
          err?.message ||
            'تعذر جلب حلقات المسلسل'
        );
      } finally {
        setEpisodesLoading(false);
      }
    }

    fetchEpisodes();
  }, [title]);

  const contentType =
    title?.type === 'series' ||
    title?.type === 'tv'
      ? 'tv'
      : 'movie';

  const realTmdbId =
    title?.tmdb_id ||
    title?.tmdbId ||
    null;

  const seasons = useMemo(() => {
    const values =
      episodes
        .map((episode) =>
          Number(episode.season)
        )
        .filter(
          (value) =>
            Number.isFinite(value)
        );

    return [
      ...new Set(values),
    ].sort(
      (a, b) => a - b
    );
  }, [episodes]);

  const seasonEpisodes =
    useMemo(() => {
      if (
        selectedSeason === null ||
        selectedSeason === undefined
      ) {
        return [];
      }

      return episodes.filter(
        (episode) =>
          Number(
            episode.season
          ) ===
          Number(selectedSeason)
      );
    }, [
      episodes,
      selectedSeason,
    ]);

  function handleSeasonChange(
    season
  ) {
    const numericSeason =
      Number(season);

    setSelectedSeason(
      numericSeason
    );

    const firstEpisode =
      episodes.find(
        (episode) =>
          Number(
            episode.season
          ) === numericSeason
      );

    setSelectedEpisode(
      firstEpisode || null
    );
  }

  function handleEpisodeChange(
    episode
  ) {
    setSelectedEpisode(
      episode
    );
  }

  if (loading) {
    return (
      <div
        style={{
          background: '#111',
          color: '#fff',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        <h1>جاري التحميل...</h1>
      </div>
    );
  }

  if (!title) {
    return (
      <div
        style={{
          background: '#111',
          color: '#fff',
          minHeight: '100vh',
          padding: '40px 20px',
          textAlign: 'center',
          direction: 'rtl',
        }}
      >
        <h1>
          العمل غير موجود
        </h1>

        {error && (
          <p
            style={{
              color: '#ff7777',
            }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  const playerTitle = {
    ...title,

    current_episode_id:
      selectedEpisode?.id ||
      null,

    current_season:
      selectedEpisode
        ? Number(
            selectedEpisode.season
          )
        : null,

    current_episode_number:
      selectedEpisode
        ? Number(
            selectedEpisode.episode_number
          )
        : null,

    current_episode_stream_urls:
      selectedEpisode?.stream_urls ||
      {},
  };

  return (
    <div
      style={{
        background: '#111',
        color: '#fff',
        minHeight: '100vh',
        padding: '20px',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            marginBottom: '15px',
            textAlign: 'center',
          }}
        >
          {title?.name ||
            title?.title ||
            'بدون عنوان'}
        </h1>

        {error && (
          <div
            style={{
              marginBottom: '15px',
              padding: '10px 12px',
              borderRadius: '9px',
              background:
                'rgba(220,60,60,.1)',
              border:
                '1px solid rgba(220,60,60,.3)',
              color: '#ff8585',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {/* اختيار الموسم والحلقات */}

        {contentType === 'tv' && (
          <div
            style={{
              marginBottom: '15px',
              padding: '14px',
              background: '#1a1a1a',
              borderRadius: '10px',
              border:
                '1px solid #292929',
            }}
          >
            {episodesLoading ? (
              <div
                style={{
                  color: '#888',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                جاري تحميل الحلقات...
              </div>
            ) : episodes.length === 0 ? (
              <div
                style={{
                  color: '#888',
                  textAlign: 'center',
                  padding: '20px',
                }}
              >
                لا توجد حلقات مستوردة لهذا المسلسل.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginBottom: '12px',
                  }}
                >
                  <span
                    style={{
                      color: '#aaa',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    الموسم:
                  </span>

                  {seasons.map(
                    (season) => (
                      <button
                        key={season}
                        type="button"
                        onClick={() =>
                          handleSeasonChange(
                            season
                          )
                        }
                        style={{
                          padding:
                            '7px 12px',
                          borderRadius:
                            '7px',
                          border:
                            Number(
                              selectedSeason
                            ) ===
                            Number(
                              season
                            )
                              ? '1px solid #d4af37'
                              : '1px solid #333',
                          background:
                            Number(
                              selectedSeason
                            ) ===
                            Number(
                              season
                            )
                              ? '#d4af37'
                              : '#222',
                          color:
                            Number(
                              selectedSeason
                            ) ===
                            Number(
                              season
                            )
                              ? '#111'
                              : '#ddd',
                          cursor:
                            'pointer',
                          fontWeight: 800,
                        }}
                      >
                        {season === 0
                          ? 'خاص'
                          : season}
                      </button>
                    )
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fill,minmax(90px,1fr))',
                    gap: '7px',
                    maxHeight:
                      '230px',
                    overflowY:
                      'auto',
                  }}
                >
                  {seasonEpisodes.map(
                    (episode) => {
                      const selected =
                        selectedEpisode?.id ===
                        episode.id;

                      return (
                        <button
                          key={
                            episode.id
                          }
                          type="button"
                          onClick={() =>
                            handleEpisodeChange(
                              episode
                            )
                          }
                          style={{
                            padding:
                              '10px 6px',
                            borderRadius:
                              '8px',
                            border:
                              selected
                                ? '1px solid #d4af37'
                                : '1px solid #333',
                            background:
                              selected
                                ? '#d4af37'
                                : '#222',
                            color:
                              selected
                                ? '#111'
                                : '#ddd',
                            cursor:
                              'pointer',
                            fontWeight: 800,
                          }}
                        >
                          حلقة{' '}
                          {
                            episode.episode_number
                          }
                        </button>
                      );
                    }
                  )}
                </div>

                {selectedEpisode && (
                  <div
                    style={{
                      marginTop:
                        '12px',
                      color: '#888',
                      fontSize:
                        '12px',
                    }}
                  >
                    {selectedEpisode.name ||
                      `الحلقة ${selectedEpisode.episode_number}`}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* المشغل */}

        <div
          style={{
            width: '100%',
            background: '#000',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow:
              '0 4px 15px rgba(0,0,0,0.5)',
          }}
        >
          <VideoPlayer
            tmdbId={realTmdbId}
            type={contentType}
            title={playerTitle}
            episodeId={
              selectedEpisode?.id ||
              null
            }
          />
        </div>

        {/* التفاصيل */}

        <div
          style={{
            marginTop: '20px',
            background: '#1a1a1a',
            padding: '15px',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '10px',
              alignItems:
                'center',
              flexWrap:
                'wrap',
            }}
          >
            {title?.is_premium && (
              <span
                style={{
                  background:
                    '#e50914',
                  color: '#fff',
                  padding:
                    '2px 8px',
                  borderRadius:
                    '4px',
                  fontSize:
                    '12px',
                  fontWeight:
                    'bold',
                }}
              >
                بريميوم ⭐
              </span>
            )}

            <span
              style={{
                background:
                  '#333',
                color: '#fff',
                padding:
                  '2px 8px',
                borderRadius:
                  '4px',
                fontSize:
                  '12px',
              }}
            >
              النوع:{' '}
              {title?.type ||
                'فيلم'}
            </span>
          </div>

          <p
            style={{
              color: '#ccc',
              lineHeight:
                '1.6',
              marginBottom:
                '15px',
            }}
          >
            {title?.synopsis ||
              title?.description ||
              'لا يوجد وصف متاح.'}
          </p>

          <div
            style={{
              fontSize: '14px',
              color: '#888',
              display: 'flex',
              gap: '15px',
              flexWrap: 'wrap',
            }}
          >
            <span>
              سنة الإصدار:{' '}
              {title?.release_year ||
                'غير متوفرة'}
            </span>

            <span>
              التقييم: ⭐{' '}
              {title?.rating_avg ??
                'غير متوفر'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
