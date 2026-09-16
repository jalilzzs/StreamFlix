import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import VideoPlayer from '../components/VideoPlayer';

export default function TitleDetail() {
  const { id } = useParams();

  const [title, setTitle] = useState(null);
  const [episodes, setEpisodes] = useState([]);

  const [selectedSeason, setSelectedSeason] =
    useState(1);

  const [selectedEpisodeId, setSelectedEpisodeId] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [episodesLoading, setEpisodesLoading] =
    useState(false);

  // =========================================================
  // جلب العمل والحلقات
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function fetchTitle() {
      try {
        setLoading(true);

        const {
          data,
          error,
        } = await supabase
          .from('titles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          throw error;
        }

        if (!cancelled) {
          setTitle(data);
        }
      } catch (error) {
        console.error(
          'خطأ في جلب بيانات العمل:',
          error
        );

        if (!cancelled) {
          setTitle(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (id) {
      fetchTitle();
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  // =========================================================
  // جلب الحلقات
  // =========================================================

  useEffect(() => {
    let cancelled = false;

    async function fetchEpisodes() {
      if (
        !id ||
        !title ||
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

        const {
          data,
          error,
        } = await supabase
          .from('episodes')
          .select('*')
          .eq('title_id', id)
          .order('season', {
            ascending: true,
          })
          .order('episode_number', {
            ascending: true,
          });

        if (error) {
          throw error;
        }

        if (!cancelled) {
          const rows = data || [];

          setEpisodes(rows);

          if (rows.length > 0) {
            const firstSeason =
              Number(
                rows[0].season || 1
              );

            setSelectedSeason(
              firstSeason
            );

            setSelectedEpisodeId(
              rows[0].id
            );
          } else {
            setSelectedSeason(1);
            setSelectedEpisodeId(null);
          }
        }
      } catch (error) {
        console.error(
          'خطأ في جلب الحلقات:',
          error
        );

        if (!cancelled) {
          setEpisodes([]);
          setSelectedEpisodeId(null);
        }
      } finally {
        if (!cancelled) {
          setEpisodesLoading(false);
        }
      }
    }

    fetchEpisodes();

    return () => {
      cancelled = true;
    };
  }, [
    id,
    title,
  ]);

  // =========================================================
  // المواسم
  // =========================================================

  const seasons = useMemo(() => {
    const values = [
      ...new Set(
        episodes
          .map((episode) =>
            Number(
              episode.season
            )
          )
          .filter(
            (season) =>
              Number.isInteger(
                season
              ) &&
              season > 0
          )
      ),
    ];

    return values.sort(
      (a, b) => a - b
    );
  }, [episodes]);

  // =========================================================
  // حلقات الموسم الحالي
  // =========================================================

  const seasonEpisodes = useMemo(() => {
    return episodes
      .filter(
        (episode) =>
          Number(
            episode.season
          ) ===
          Number(selectedSeason)
      )
      .sort(
        (a, b) =>
          Number(
            a.episode_number
          ) -
          Number(
            b.episode_number
          )
      );
  }, [
    episodes,
    selectedSeason,
  ]);

  // =========================================================
  // الحلقة الحالية
  // =========================================================

  const selectedEpisode = useMemo(() => {
    if (!seasonEpisodes.length) {
      return null;
    }

    const byId =
      seasonEpisodes.find(
        (episode) =>
          episode.id ===
          selectedEpisodeId
      );

    if (byId) {
      return byId;
    }

    return seasonEpisodes[0];
  }, [
    seasonEpisodes,
    selectedEpisodeId,
  ]);

  // =========================================================
  // عند تغيير الموسم
  // =========================================================

  const handleSeasonChange = (
    season
  ) => {
    const numericSeason =
      Number(season);

    setSelectedSeason(
      numericSeason
    );

    const firstEpisode =
      episodes
        .filter(
          (episode) =>
            Number(
              episode.season
            ) ===
            numericSeason
        )
        .sort(
          (a, b) =>
            Number(
              a.episode_number
            ) -
            Number(
              b.episode_number
            )
        )[0];

    setSelectedEpisodeId(
      firstEpisode?.id ||
        null
    );
  };

  // =========================================================
  // عند تغيير الحلقة
  // =========================================================

  const handleEpisodeChange = (
    episode
  ) => {
    if (!episode) return;

    setSelectedEpisodeId(
      episode.id
    );
  };

  // =========================================================
  // Loading
  // =========================================================

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#111',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl',
        }}
      >
        جاري التحميل...
      </div>
    );
  }

  // =========================================================
  // Not found
  // =========================================================

  if (!title) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#111',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl',
        }}
      >
        العمل غير موجود.
      </div>
    );
  }

  const tmdbId =
    title.tmdb_id ||
    title.tmdbId ||
    title.tmdb ||
    null;

  const type =
    title.type === 'series' ||
    title.type === 'tv'
      ? 'tv'
      : 'movie';

  // =========================================================
  // البيانات التي نمررها للـ VideoPlayer
  // =========================================================

  const playerTitle = {
    ...title,

    current_episode_id:
      selectedEpisode?.id ||
      null,

    current_season:
      selectedEpisode?.season ||
      selectedSeason ||
      1,

    current_episode_number:
      selectedEpisode?.episode_number ||
      1,

    // هذا هو الحقل الحقيقي في DB
    current_episode_stream_urls:
      selectedEpisode?.stream_urls ||
      {},
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#111',
        color: '#fff',
        padding: '20px',
        direction: 'rtl',
      }}
    >
      <h1
        style={{
          fontSize: '24px',
          marginBottom: '15px',
          textAlign: 'center',
        }}
      >
        {title.name ||
          title.title ||
          'بدون عنوان'}
      </h1>

      <div
        style={{
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto',
          background: '#000',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow:
            '0 4px 15px rgba(0,0,0,0.5)',
        }}
      >
        <VideoPlayer
          tmdbId={tmdbId}
          type={type}
          title={playerTitle}
          episodeId={
            selectedEpisode?.id ||
            null
          }
        />
      </div>

      {/* =====================================================
          اختيار الموسم والحلقة
      ===================================================== */}

      {type === 'tv' && (
        <div
          style={{
            maxWidth: '900px',
            margin: '20px auto',
            background: '#1a1a1a',
            padding: '15px',
            borderRadius: '8px',
          }}
        >
          {episodesLoading ? (
            <div
              style={{
                color: '#888',
                textAlign: 'center',
                padding: '15px',
              }}
            >
              جاري تحميل الحلقات...
            </div>
          ) : episodes.length === 0 ? (
            <div
              style={{
                color: '#888',
                textAlign: 'center',
                padding: '15px',
              }}
            >
              لا توجد حلقات متاحة لهذا المسلسل.
            </div>
          ) : (
            <>
              {/* المواسم */}

              <div
                style={{
                  marginBottom: '18px',
                }}
              >
                <div
                  style={{
                    color: '#aaa',
                    fontSize: '13px',
                    marginBottom: '9px',
                  }}
                >
                  الموسم:
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {seasons.map(
                    (season) => {
                      const active =
                        Number(
                          selectedSeason
                        ) ===
                        Number(
                          season
                        );

                      return (
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
                              '8px 14px',
                            borderRadius:
                              '8px',
                            border: active
                              ? '1px solid #d4af37'
                              : '1px solid #333',
                            background:
                              active
                                ? '#d4af37'
                                : '#222',
                            color:
                              active
                                ? '#111'
                                : '#ccc',
                            cursor:
                              'pointer',
                            fontWeight:
                              active
                                ? 800
                                : 500,
                          }}
                        >
                          {season}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* الحلقات */}

              <div>
                <div
                  style={{
                    color: '#aaa',
                    fontSize: '13px',
                    marginBottom: '9px',
                  }}
                >
                  حلقات الموسم{' '}
                  {selectedSeason}:
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fill,minmax(130px,1fr))',
                    gap: '8px',
                  }}
                >
                  {seasonEpisodes.map(
                    (episode) => {
                      const active =
                        episode.id ===
                        selectedEpisode?.id;

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
                            minHeight:
                              '52px',
                            padding:
                              '8px',
                            borderRadius:
                              '8px',
                            border: active
                              ? '1px solid #d4af37'
                              : '1px solid #333',
                            background:
                              active
                                ? 'rgba(212,175,55,.15)'
                                : '#111',
                            color:
                              active
                                ? '#d4af37'
                                : '#ccc',
                            cursor:
                              'pointer',
                            textAlign:
                              'right',
                          }}
                        >
                          <div
                            style={{
                              fontSize:
                                '12px',
                              fontWeight:
                                800,
                            }}
                          >
                            الحلقة{' '}
                            {
                              episode.episode_number
                            }
                          </div>

                          {episode.name && (
                            <div
                              style={{
                                marginTop:
                                  '3px',
                                fontSize:
                                  '10px',
                                color:
                                  active
                                    ? '#d4af37'
                                    : '#777',
                                overflow:
                                  'hidden',
                                whiteSpace:
                                  'nowrap',
                                textOverflow:
                                  'ellipsis',
                              }}
                            >
                              {
                                episode.name
                              }
                            </div>
                          )}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================
          معلومات العمل
      ===================================================== */}

      <div
        style={{
          maxWidth: '900px',
          margin: '20px auto',
          background: '#1a1a1a',
          padding: '15px',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {title.is_premium && (
            <span
              style={{
                background: '#e50914',
                color: '#fff',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              بريميوم ⭐
            </span>
          )}

          <span
            style={{
              background: '#333',
              color: '#fff',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            {type === 'tv'
              ? 'مسلسل'
              : 'فيلم'}
          </span>

          {type === 'tv' &&
            selectedEpisode && (
              <span
                style={{
                  background: '#222',
                  color: '#d4af37',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                S
                {String(
                  selectedEpisode.season
                ).padStart(2, '0')}
                E
                {String(
                  selectedEpisode.episode_number
                ).padStart(2, '0')}
              </span>
            )}
        </div>

        <p
          style={{
            color: '#ccc',
            lineHeight: '1.7',
            marginBottom: '15px',
          }}
        >
          {title.synopsis ||
            title.description ||
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
          {title.release_year && (
            <span>
              سنة الإصدار:{' '}
              {title.release_year}
            </span>
          )}

          <span>
            التقييم: ⭐{' '}
            {Number(
              title.rating_avg || 0
            ).toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
