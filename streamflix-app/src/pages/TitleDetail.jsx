import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import VideoPlayer from '../components/VideoPlayer';

export default function TitleDetail() {
  const { id } = useParams();

  const [title, setTitle] = useState(null);
  const [episodes, setEpisodes] = useState([]);

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] =
    useState(false);

  useEffect(() => {
    async function fetchTitle() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('titles')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        setTitle(data);
      } catch (error) {
        console.error(
          'خطأ في جلب بيانات العمل:',
          error
        );

        setTitle(null);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchTitle();
    }
  }, [id]);

  const tmdbId =
    title?.tmdb_id ||
    title?.tmdbId ||
    title?.tmdb ||
    null;

  const type =
    title?.type === 'series' ||
    title?.type === 'tv'
      ? 'tv'
      : 'movie';

  /*
   * جلب حلقات المسلسل
   */
  useEffect(() => {
    async function fetchEpisodes() {
      if (!id || type !== 'tv') {
        setEpisodes([]);
        return;
      }

      try {
        setLoadingEpisodes(true);

        const { data, error } = await supabase
          .from('episodes')
          .select('*')
          .eq('title_id', id)
          .order('season', {
            ascending: true,
          })
          .order('episode_number', {
            ascending: true,
          });

        if (error) throw error;

        const loadedEpisodes = data || [];

        setEpisodes(loadedEpisodes);

        /*
         * اختيار أول حلقة متوفرة تلقائيًا
         */
        if (loadedEpisodes.length > 0) {
          const firstEpisode =
            loadedEpisodes[0];

          setSelectedSeason(
            Number(
              firstEpisode.season || 1
            )
          );

          setSelectedEpisode(
            firstEpisode
          );
        }
      } catch (error) {
        console.error(
          'خطأ في جلب الحلقات:',
          error
        );

        setEpisodes([]);
      } finally {
        setLoadingEpisodes(false);
      }
    }

    fetchEpisodes();
  }, [id, type]);

  /*
   * المواسم الموجودة
   */
  const seasons = useMemo(() => {
    const values = [
      ...new Set(
        episodes
          .map((episode) =>
            Number(episode.season)
          )
          .filter((season) =>
            Number.isFinite(season)
          )
      ),
    ];

    return values.sort(
      (a, b) => a - b
    );
  }, [episodes]);

  /*
   * حلقات الموسم الحالي
   */
  const seasonEpisodes = useMemo(() => {
    return episodes
      .filter(
        (episode) =>
          Number(episode.season) ===
          Number(selectedSeason)
      )
      .sort(
        (a, b) =>
          Number(a.episode_number) -
          Number(b.episode_number)
      );
  }, [
    episodes,
    selectedSeason,
  ]);

  /*
   * تغيير الموسم
   */
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
          Number(episode.season) ===
          numericSeason
      );

    setSelectedEpisode(
      firstEpisode || null
    );
  }

  /*
   * تغيير الحلقة
   */
  function handleEpisodeChange(
    episodeId
  ) {
    const episode =
      episodes.find(
        (item) =>
          String(item.id) ===
          String(episodeId)
      );

    if (!episode) return;

    setSelectedEpisode(
      episode
    );

    setSelectedSeason(
      Number(
        episode.season || 1
      )
    );
  }

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

      {/* =========================
          EPISODE SELECTOR
          ========================= */}

      {type === 'tv' && (
        <div
          style={{
            width: '100%',
            maxWidth: '900px',
            margin: '0 auto 15px',
            background: '#1a1a1a',
            borderRadius: '10px',
            padding: '15px',
            boxSizing: 'border-box',
          }}
        >
          {loadingEpisodes ? (
            <div
              style={{
                textAlign: 'center',
                color: '#888',
                padding: '10px',
              }}
            >
              جاري تحميل الحلقات...
            </div>
          ) : episodes.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: '#888',
                padding: '10px',
              }}
            >
              لا توجد حلقات متاحة لهذا المسلسل.
            </div>
          ) : (
            <>
              {/* SEASONS */}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
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
                          Number(season)
                            ? '1px solid #d4af37'
                            : '1px solid #333',
                        background:
                          Number(
                            selectedSeason
                          ) ===
                          Number(season)
                            ? '#d4af37'
                            : '#181818',
                        color:
                          Number(
                            selectedSeason
                          ) ===
                          Number(season)
                            ? '#111'
                            : '#ddd',
                        cursor:
                          'pointer',
                        fontSize:
                          '12px',
                        fontWeight:
                          700,
                      }}
                    >
                      {season}
                    </button>
                  )
                )}
              </div>

              {/* EPISODES */}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    color: '#aaa',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  الحلقة:
                </span>

                {seasonEpisodes.map(
                  (episode) => {
                    const isActive =
                      String(
                        selectedEpisode?.id
                      ) ===
                      String(
                        episode.id
                      );

                    return (
                      <button
                        key={episode.id}
                        type="button"
                        onClick={() =>
                          handleEpisodeChange(
                            episode.id
                          )
                        }
                        style={{
                          minWidth: '42px',
                          padding:
                            '7px 10px',
                          borderRadius:
                            '7px',
                          border:
                            isActive
                              ? '1px solid #d4af37'
                              : '1px solid #333',
                          background:
                            isActive
                              ? '#d4af37'
                              : '#181818',
                          color:
                            isActive
                              ? '#111'
                              : '#ddd',
                          cursor:
                            'pointer',
                          fontSize:
                            '12px',
                          fontWeight:
                            700,
                        }}
                        title={
                          episode.name ||
                          `الحلقة ${episode.episode_number}`
                        }
                      >
                        {episode.episode_number}
                      </button>
                    );
                  }
                )}
              </div>

              {/* CURRENT EPISODE */}

              {selectedEpisode && (
                <div
                  style={{
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop:
                      '1px solid #292929',
                    color: '#aaa',
                    fontSize: '12px',
                  }}
                >
                  تشاهد الآن:
                  <strong
                    style={{
                      color: '#d4af37',
                      marginRight: '5px',
                    }}
                  >
                    موسم{' '}
                    {
                      selectedEpisode.season
                    }{' '}
                    • حلقة{' '}
                    {
                      selectedEpisode.episode_number
                    }
                  </strong>

                  {selectedEpisode.name && (
                    <span
                      style={{
                        marginRight:
                          '8px',
                        color: '#777',
                      }}
                    >
                      —
                      {' '}
                      {
                        selectedEpisode.name
                      }
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =========================
          VIDEO PLAYER
          ========================= */}

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
          title={{
            ...title,

            /*
             * نمرر بيانات الحلقة الحالية
             * للـVideoPlayer
             */

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

            /*
             * StreamSrc الخاص بالحلقة
             */
            stream_url:
              selectedEpisode?.stream_url ||
              title.stream_url ||
              null,

            /*
             * Stelar الخاص بالحلقة
             * إذا كان موجودًا في episode.
             */
            url:
              selectedEpisode?.url ||
              selectedEpisode?.video_url ||
              title.url ||
              title.video_url ||
              null,
          }}
          episodeId={
            selectedEpisode?.id ||
            null
          }
        />
      </div>

      {/* =========================
          TITLE INFO
          ========================= */}

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
