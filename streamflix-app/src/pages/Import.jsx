import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w500';

const STREAMSRC_BASE_URL = 'https://streamsrc.cc';
const STELLAR_BASE_URL = 'https://stellar.rip/en/watch/embed';

const TMDB_TOKEN =
  import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN;

function getPosterUrl(path) {
  if (!path) return null;

  if (
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }

  return `${TMDB_IMAGE_URL}${path}`;
}

function getStellarMovieUrl(tmdbId) {
  if (!tmdbId) return null;

  return `${STELLAR_BASE_URL}/movie/${tmdbId}`;
}

function getStellarEpisodeUrl(
  tmdbId,
  season,
  episode
) {
  if (!tmdbId || !season || !episode) {
    return null;
  }

  return `${STELLAR_BASE_URL}/tv/${tmdbId}-${season}-${episode}`;
}

function getStreamSrcMovieUrl(tmdbId) {
  if (!tmdbId) return null;

  return `${STREAMSRC_BASE_URL}/watch/movie/tmdbid=${encodeURIComponent(
    tmdbId
  )}`;
}

function getStreamSrcSeriesUrl(tmdbId) {
  if (!tmdbId) return null;

  return `${STREAMSRC_BASE_URL}/watch/series/tmdbid=${encodeURIComponent(
    tmdbId
  )}`;
}

async function tmdbFetch(path) {
  if (!TMDB_TOKEN) {
    throw new Error(
      'VITE_TMDB_READ_ACCESS_TOKEN غير موجود'
    );
  }

  const response = await fetch(
    `${TMDB_BASE_URL}${path}`,
    {
      headers: {
        Authorization: `Bearer ${TMDB_TOKEN}`,
        accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `TMDB ${response.status}: ${
        text || response.statusText
      }`
    );
  }

  return response.json();
}

function formatMovie(item) {
  return {
    tmdb_id: item.id,
    type: 'movie',
    name:
      item.title ||
      item.original_title ||
      'بدون عنوان',
    synopsis:
      item.overview ||
      null,
    poster_url: getPosterUrl(
      item.poster_path
    ),
    release_year: item.release_date
      ? Number(item.release_date.slice(0, 4))
      : null,
    rating_avg:
      typeof item.vote_average === 'number'
        ? item.vote_average
        : null,
    is_premium: false,
    url: getStellarMovieUrl(item.id),
  };
}

function formatSeries(item) {
  return {
    tmdb_id: item.id,
    type: 'series',
    name:
      item.name ||
      item.original_name ||
      'بدون عنوان',
    synopsis:
      item.overview ||
      null,
    poster_url: getPosterUrl(
      item.poster_path
    ),
    release_year: item.first_air_date
      ? Number(item.first_air_date.slice(0, 4))
      : null,
    rating_avg:
      typeof item.vote_average === 'number'
        ? item.vote_average
        : null,
    is_premium: false,

    /*
     * لا نعتمد على هذا الرابط لتشغيل حلقة.
     * روابط الحلقات الحقيقية تتخزن داخل episodes.stream_urls.
     * نضع S1E1 فقط كقيمة قديمة/احتياطية.
     */
    url: getStellarEpisodeUrl(
      item.id,
      1,
      1
    ),
  };
}

async function findExistingTitle(tmdbId) {
  const { data, error } = await supabase
    .from('titles')
    .select(
      'id,tmdb_id,url,type,name'
    )
    .eq('tmdb_id', tmdbId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function saveTitle(item) {
  const existing =
    await findExistingTitle(item.tmdb_id);

  if (existing) {
    /*
     * نحدث المعلومات دائماً.
     * لا نمسح URL موجود.
     */
    const updateData = {
      tmdb_id: item.tmdb_id,
      type: item.type,
      name: item.name,
      synopsis: item.synopsis,
      poster_url: item.poster_url,
      release_year: item.release_year,
      rating_avg: item.rating_avg,
      is_premium:
        typeof item.is_premium === 'boolean'
          ? item.is_premium
          : false,
    };

    if (!existing.url && item.url) {
      updateData.url = item.url;
    }

    const { data, error } = await supabase
      .from('titles')
      .update(updateData)
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return {
      title: data,
      created: false,
      updated: true,
    };
  }

  const { data, error } = await supabase
    .from('titles')
    .insert({
      tmdb_id: item.tmdb_id,
      type: item.type,
      name: item.name,
      synopsis: item.synopsis,
      poster_url: item.poster_url,
      release_year: item.release_year,
      rating_avg: item.rating_avg,
      is_premium:
        typeof item.is_premium === 'boolean'
          ? item.is_premium
          : false,
      url: item.url || null,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return {
    title: data,
    created: true,
    updated: false,
  };
}

async function importSeriesEpisodes(
  series,
  titleId,
  seasonNumber
) {
  const seasonData =
    await tmdbFetch(
      `/tv/${series.id}/season/${seasonNumber}`
    );

  const tmdbEpisodes =
    seasonData?.episodes || [];

  if (!tmdbEpisodes.length) {
    return 0;
  }

  const { data: existingEpisodes, error } =
    await supabase
      .from('episodes')
      .select(
        'id,season,episode_number,stream_urls'
      )
      .eq('title_id', titleId)
      .eq('season', seasonNumber);

  if (error) {
    throw error;
  }

  const existingMap = new Map();

  (existingEpisodes || []).forEach(
    (episode) => {
      existingMap.set(
        Number(episode.episode_number),
        episode
      );
    }
  );

  /*
   * نحذف صفوف الموسم ثم نعيد بناءها.
   * لكن روابط السيرفرات القديمة نحافظ عليها.
   */
  const { error: deleteError } =
    await supabase
      .from('episodes')
      .delete()
      .eq('title_id', titleId)
      .eq('season', seasonNumber);

  if (deleteError) {
    throw deleteError;
  }

  const rows = tmdbEpisodes.map(
    (episode) => {
      const episodeNumber =
        Number(episode.episode_number);

      const oldEpisode =
        existingMap.get(
          episodeNumber
        );

      const oldStreamUrls =
        oldEpisode?.stream_urls &&
        typeof oldEpisode.stream_urls ===
          'object'
          ? oldEpisode.stream_urls
          : {};

      const stellarUrl =
        getStellarEpisodeUrl(
          series.id,
          seasonNumber,
          episodeNumber
        );

      const streamSrcUrl =
        getStreamSrcSeriesUrl(
          series.id
        );

      return {
        title_id: titleId,
        season: seasonNumber,
        episode_number:
          episodeNumber,
        name:
          episode.name ||
          `الحلقة ${episodeNumber}`,
        synopsis:
          episode.overview ||
          null,
        still_url: getPosterUrl(
          episode.still_path
        ),
        air_date:
          episode.air_date ||
          null,

        /*
         * الأهم:
         * الرابط القديم يبقى إذا كان موجود.
         * وإذا لم يكن موجود نضع الرابط الجديد.
         */
        stream_urls: {
          ...oldStreamUrls,

          server1:
            oldStreamUrls.server1 ||
            oldStreamUrls.stelar ||
            oldStreamUrls.stelar_rip ||
            stellarUrl ||
            null,

          server2:
            oldStreamUrls.server2 ||
            oldStreamUrls.streamsrc ||
            streamSrcUrl ||
            null,
        },
      };
    }
  );

  const chunkSize = 100;

  for (
    let i = 0;
    i < rows.length;
    i += chunkSize
  ) {
    const chunk = rows.slice(
      i,
      i + chunkSize
    );

    const { error: insertError } =
      await supabase
        .from('episodes')
        .insert(chunk);

    if (insertError) {
      throw insertError;
    }
  }

  return rows.length;
}

async function importSeries(
  series,
  titleId
) {
  const details =
    await tmdbFetch(
      `/tv/${series.id}`
    );

  const seasons =
    details?.seasons || [];

  let totalEpisodes = 0;

  for (const season of seasons) {
    const seasonNumber =
      Number(season.season_number);

    if (
      !Number.isFinite(
        seasonNumber
      )
    ) {
      continue;
    }

    /*
     * يمكن تجاهل Season 0 الخاص بالـ Specials
     * إذا لم تكن هناك حلقات.
     */
    if (
      seasonNumber === 0 &&
      Number(season.episode_count || 0) === 0
    ) {
      continue;
    }

    totalEpisodes +=
      await importSeriesEpisodes(
        series,
        titleId,
        seasonNumber
      );
  }

  return totalEpisodes;
}

export default function Import() {
  const [query, setQuery] =
    useState('');

  const [movies, setMovies] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [bulkLoading, setBulkLoading] =
    useState(false);

  const [message, setMessage] =
    useState('');

  const [error, setError] =
    useState('');

  const [searchType, setSearchType] =
    useState('multi');

  const [importingId, setImportingId] =
    useState(null);

  const [importedIds, setImportedIds] =
    useState([]);

  const [bulkProgress, setBulkProgress] =
    useState({
      current: 0,
      total: 0,
    });

  const providerInfo = useMemo(
    () => ({
      server1: 'Stellar',
      server2: 'StreamSrc',
    }),
    []
  );

  async function searchTMDB() {
    const value = query.trim();

    if (!value) {
      setError('اكتب اسم الفيلم أو المسلسل أولاً');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');
      setMovies([]);

      let endpoint =
        `/search/multi?query=${encodeURIComponent(
          value
        )}&include_adult=false&language=fr-FR&page=1`;

      if (searchType === 'movie') {
        endpoint =
          `/search/movie?query=${encodeURIComponent(
            value
          )}&include_adult=false&language=fr-FR&page=1`;
      }

      if (searchType === 'series') {
        endpoint =
          `/search/tv?query=${encodeURIComponent(
            value
          )}&include_adult=false&language=fr-FR&page=1`;
      }

      const result =
        await tmdbFetch(endpoint);

      const results =
        (result?.results || []).filter(
          (item) =>
            item &&
            item.id &&
            (
              searchType === 'multi'
                ? item.media_type === 'movie' ||
                  item.media_type === 'tv'
                : true
            )
        );

      setMovies(results);
    } catch (err) {
      console.error(
        'TMDB search error:',
        err
      );

      setError(
        err?.message ||
          'تعذر البحث في TMDB'
      );
    } finally {
      setLoading(false);
    }
  }

  async function importSingleItem(item) {
    if (!item?.id) return;

    try {
      setImportingId(item.id);
      setError('');
      setMessage('');

      const isSeries =
        item.media_type === 'tv' ||
        searchType === 'series';

      const formatted =
        isSeries
          ? formatSeries(item)
          : formatMovie(item);

      const saved =
        await saveTitle(formatted);

      let episodeCount = 0;

      if (
        isSeries &&
        saved?.title?.id
      ) {
        episodeCount =
          await importSeries(
            item,
            saved.title.id
          );
      }

      setImportedIds(
        (current) =>
          current.includes(item.id)
            ? current
            : [...current, item.id]
      );

      setMessage(
        `${saved.created ? 'تمت إضافة' : 'تم تحديث'} "${
          formatted.name
        }"${
          isSeries
            ? ` — ${episodeCount} حلقة`
            : ''
        }`
      );
    } catch (err) {
      console.error(
        'Import error:',
        err
      );

      setError(
        err?.message ||
          'فشل الاستيراد'
      );
    } finally {
      setImportingId(null);
    }
  }

  async function importAll() {
    if (!movies.length) {
      setError(
        'لا توجد نتائج للاستيراد'
      );
      return;
    }

    try {
      setBulkLoading(true);
      setError('');
      setMessage('');

      let updated = 0;
      let created = 0;
      let episodes = 0;

      setBulkProgress({
        current: 0,
        total: movies.length,
      });

      for (
        let index = 0;
        index < movies.length;
        index++
      ) {
        const item = movies[index];

        try {
          const isSeries =
            item.media_type === 'tv' ||
            searchType === 'series';

          const formatted =
            isSeries
              ? formatSeries(item)
              : formatMovie(item);

          const saved =
            await saveTitle(formatted);

          if (saved.created) {
            created++;
          } else {
            updated++;
          }

          if (
            isSeries &&
            saved?.title?.id
          ) {
            episodes +=
              await importSeries(
                item,
                saved.title.id
              );
          }

          setImportedIds(
            (current) =>
              current.includes(item.id)
                ? current
                : [...current, item.id]
          );
        } catch (itemError) {
          console.error(
            'Bulk item error:',
            item,
            itemError
          );
        }

        setBulkProgress({
          current: index + 1,
          total: movies.length,
        });
      }

      setMessage(
        `اكتمل الاستيراد — جديد: ${created} | محدث: ${updated} | الحلقات: ${episodes}`
      );
    } catch (err) {
      console.error(
        'Bulk import error:',
        err
      );

      setError(
        err?.message ||
          'فشل الاستيراد الجماعي'
      );
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleFixUrls() {
    try {
      setLoading(true);
      setError('');
      setMessage('');

      const { data, error: fetchError } =
        await supabase
          .from('titles')
          .select(
            'id,tmdb_id,type,url,poster_url'
          )
          .not('tmdb_id', 'is', null);

      if (fetchError) {
        throw fetchError;
      }

      let fixed = 0;

      for (const title of data || []) {
        if (!title.tmdb_id) {
          continue;
        }

        const update = {};

        if (
          !title.url
        ) {
          update.url =
            title.type === 'movie'
              ? getStellarMovieUrl(
                  title.tmdb_id
                )
              : getStellarEpisodeUrl(
                  title.tmdb_id,
                  1,
                  1
                );
        }

        if (
          title.type === 'tv'
        ) {
          update.type = 'series';
        }

        if (
          Object.keys(update).length
        ) {
          const { error } =
            await supabase
              .from('titles')
              .update(update)
              .eq(
                'id',
                title.id
              );

          if (error) {
            throw error;
          }

          fixed++;
        }
      }

      setMessage(
        `تم إصلاح ${fixed} عنوان`
      );
    } catch (err) {
      console.error(
        'Fix URLs error:',
        err
      );

      setError(
        err?.message ||
          'تعذر إصلاح الروابط'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#111',
        color: '#fff',
        padding: '25px',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: '8px',
          }}
        >
          استيراد المحتوى
        </h1>

        <div
          style={{
            color: '#888',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          Server 1: {providerInfo.server1}
          {' • '}
          Server 2: {providerInfo.server2}
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '15px',
          }}
        >
          <button
            type="button"
            onClick={() =>
              setSearchType('multi')
            }
            style={buttonStyle(
              searchType === 'multi'
            )}
          >
            الكل
          </button>

          <button
            type="button"
            onClick={() =>
              setSearchType('movie')
            }
            style={buttonStyle(
              searchType === 'movie'
            )}
          >
            أفلام
          </button>

          <button
            type="button"
            onClick={() =>
              setSearchType('series')
            }
            style={buttonStyle(
              searchType === 'series'
            )}
          >
            مسلسلات
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '12px',
          }}
        >
          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            onKeyDown={(event) => {
              if (
                event.key === 'Enter'
              ) {
                searchTMDB();
              }
            }}
            placeholder="ابحث عن فيلم أو مسلسل..."
            style={{
              flex: 1,
              minWidth: 0,
              padding: '13px',
              borderRadius: '9px',
              border:
                '1px solid #333',
              background: '#1b1b1b',
              color: '#fff',
              outline: 'none',
            }}
          />

          <button
            type="button"
            onClick={searchTMDB}
            disabled={loading}
            style={{
              padding:
                '0 20px',
              border: 'none',
              borderRadius: '9px',
              background:
                '#d4af37',
              color: '#111',
              fontWeight: 900,
              cursor:
                loading
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {loading
              ? 'جاري...'
              : 'بحث'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}
        >
          <button
            type="button"
            onClick={importAll}
            disabled={
              bulkLoading ||
              !movies.length
            }
            style={{
              padding: '10px 16px',
              border: '1px solid #d4af37',
              borderRadius: '8px',
              background:
                movies.length &&
                !bulkLoading
                  ? '#d4af37'
                  : '#292929',
              color:
                movies.length &&
                !bulkLoading
                  ? '#111'
                  : '#777',
              fontWeight: 900,
              cursor:
                movies.length &&
                !bulkLoading
                  ? 'pointer'
                  : 'not-allowed',
            }}
          >
            {bulkLoading
              ? `جاري ${bulkProgress.current}/${bulkProgress.total}`
              : 'استيراد كل النتائج'}
          </button>

          <button
            type="button"
            onClick={handleFixUrls}
            disabled={loading}
            style={{
              padding: '10px 16px',
              border:
                '1px solid #333',
              borderRadius: '8px',
              background: '#1b1b1b',
              color: '#ddd',
              fontWeight: 700,
              cursor:
                loading
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            إصلاح الروابط
          </button>
        </div>

        {message && (
          <div
            style={{
              padding: '11px 13px',
              borderRadius: '9px',
              marginBottom: '15px',
              background:
                'rgba(40,180,90,.1)',
              border:
                '1px solid rgba(40,180,90,.25)',
              color: '#78df9a',
              fontSize: '13px',
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '11px 13px',
              borderRadius: '9px',
              marginBottom: '15px',
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill,minmax(210px,1fr))',
            gap: '15px',
          }}
        >
          {movies.map((item) => {
            const isSeries =
              item.media_type === 'tv' ||
              searchType === 'series';

            const itemName =
              item.title ||
              item.name ||
              item.original_title ||
              item.original_name ||
              'بدون عنوان';

            const imported =
              importedIds.includes(
                item.id
              );

            const importing =
              importingId === item.id;

            return (
              <div
                key={item.id}
                style={{
                  background:
                    '#1a1a1a',
                  border:
                    '1px solid #292929',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {item.poster_path ? (
                  <img
                    src={getPosterUrl(
                      item.poster_path
                    )}
                    alt=""
                    style={{
                      width: '100%',
                      height: '290px',
                      objectFit:
                        'cover',
                      display:
                        'block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: '290px',
                      background:
                        '#222',
                      display:
                        'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      fontSize: '40px',
                    }}
                  >
                    🎬
                  </div>
                )}

                <div
                  style={{
                    padding: '12px',
                  }}
                >
                  <strong
                    style={{
                      display:
                        'block',
                      marginBottom:
                        '6px',
                    }}
                  >
                    {itemName}
                  </strong>

                  <div
                    style={{
                      color: '#888',
                      fontSize: '11px',
                      marginBottom:
                        '10px',
                    }}
                  >
                    {isSeries
                      ? 'مسلسل'
                      : 'فيلم'}
                    {' • '}
                    TMDB {item.id}
                  </div>

                  <button
                    type="button"
                    disabled={
                      importing ||
                      bulkLoading
                    }
                    onClick={() =>
                      importSingleItem(
                        item
                      )
                    }
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: 'none',
                      borderRadius: '8px',
                      background:
                        imported
                          ? '#315f3e'
                          : '#d4af37',
                      color:
                        imported
                          ? '#b8e9c5'
                          : '#111',
                      fontWeight: 900,
                      cursor:
                        importing ||
                        bulkLoading
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    {importing
                      ? 'جاري الاستيراد...'
                      : imported
                        ? 'تم الاستيراد / التحديث'
                        : isSeries
                          ? 'استيراد المسلسل'
                          : 'استيراد الفيلم'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!loading &&
          !movies.length &&
          !error && (
            <div
              style={{
                textAlign: 'center',
                color: '#666',
                padding: '60px 20px',
              }}
            >
              ابحث عن محتوى للبدء
            </div>
          )}
      </div>
    </div>
  );
}

function buttonStyle(active) {
  return {
    padding: '8px 14px',
    borderRadius: '8px',
    border: active
      ? '1px solid #d4af37'
      : '1px solid #333',
    background: active
      ? '#d4af37'
      : '#1b1b1b',
    color: active
      ? '#111'
      : '#ccc',
    fontWeight: 800,
    cursor: 'pointer',
  };
}
