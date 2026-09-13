// دالة استيراد فيلم جديد من TMDB مع توليد رابط المشاهدة أوتوماتيكياً
async function importMovieFromTMDB(movie) {
  try {
    // توليد الرابط أوتوماتيكياً باستخدام الـ TMDB ID
    const generatedUrl = `https://vidsrc.to/embed/movie/${movie.id}`;

    const { data, error } = await supabase
      .from('titles')
      .insert([
        {
          name: movie.title || movie.name,
          synopsis: movie.overview,
          release_year: movie.release_date ? parseInt(movie.release_date.split('-')[0]) : 2026,
          rating_avg: movie.vote_average || 0,
          type: 'movie',
          is_premium: false,
          poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
          url: generatedUrl // الرابط يتولد ويتحط وحدو صاي!
        }
      ]);

    if (error) {
      console.error("خطأ أثناء إدخال الفيلم:", error.message);
    } else {
      console.log("تم استيراد الفيلم بنجاح مع رابطه:", movie.title);
    }
  } catch (err) {
    console.error("حدث خطأ غير متوقع:", err);
  }
}
