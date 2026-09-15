import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const KEY='826b5838634812328768a35607b22a01';
const BASE='https://api.themoviedb.org/3';
const IMG='https://image.tmdb.org/t/p/w500';

export default function Import(){
 const [q,setQ]=useState(''),[kind,setKind]=useState('movie'),[results,setResults]=useState([]),[searching,setSearching]=useState(false);
 const [pages,setPages]=useState(''),[bulkKind,setBulkKind]=useState('both'),[source,setSource]=useState('popular'),[bulk,setBulk]=useState(false);
 const [seriesQ,setSeriesQ]=useState(''),[seriesResults,setSeriesResults]=useState([]),[seriesSearching,setSeriesSearching]=useState(false);
 const [episodeLimit,setEpisodeLimit]=useState(''),[seriesBusy,setSeriesBusy]=useState(false),[logs,setLogs]=useState([]);

 const log=x=>setLogs(p=>[`[${new Date().toLocaleTimeString('en-US',{hour12:false})}] ${x}`,...p].slice(0,150));
 const api=async(path,params={})=>{
   const u=new URL(BASE+path);u.searchParams.set('api_key',KEY);
   Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
   const r=await fetch(u);const d=await r.json();if(!r.ok)throw Error(d.status_message||`TMDB ${r.status}`);return d;
 };
 const session=async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session?.user)throw Error('يجب تسجيل الدخول أولاً.');return session;};
 const row=(x,type)=>({tmdb_id:x.id,title:x.title||x.name||'بدون عنوان',type:type==='tv'?'series':'movie',synopsis:x.overview||'لا يوجد وصف متاح.',poster_path:x.poster_path?IMG+x.poster_path:null,backdrop_path:x.backdrop_path?`https://image.tmdb.org/t/p/w1280${x.backdrop_path}`:null,release_year:parseInt((x.release_date||x.first_air_date||'').slice(0,4))||new Date().getFullYear(),rating_avg:Number((x.vote_average||0).toFixed(1)),is_premium:false});
 const save=async(rows)=>{await session();const {data,error}=await supabase.from('titles').upsert(rows,{onConflict:'tmdb_id'}).select('id,tmdb_id,title');if(error)throw error;return data?.length||rows.length;};

 const search=async e=>{e.preventDefault();if(!q.trim())return;setSearching(true);setResults([]);try{
   const d=/^\d+$/.test(q.trim())?{results:[await api(`/${kind}/${q.trim()}`,{language:'ar-SA'})]}:await api(`/search/${kind}`,{query:q.trim(),language:'ar-SA',page:1,include_adult:'false'});
   setResults(d.results||[]);log(`🔎 تم العثور على ${d.results?.length||0} نتيجة.`);
 }catch(e){log(`❌ ${e.message}`)}finally{setSearching(false)}};

 const single=async x=>{try{const n=await save([row(x,kind)]);log(`🎉 تم استيراد "${x.title||x.name}" (${n}).`)}catch(e){log(`❌ ${e.message}`)}};

 const bulkImport=async()=>{const n=Number(pages);if(!Number.isInteger(n)||n<1||n>30){log('⚠️ اكتب عدد صفحات من 1 إلى 30.');return}setBulk(true);
   const types=bulkKind==='both'?['movie','tv']:[bulkKind];let total=0;
   try{await session();for(let p=1;p<=n;p++)for(const t of types){log(`📥 ${source==='trending'?'Trending':'Popular'} ${t==='movie'?'أفلام':'مسلسلات'} — صفحة ${p}/${n}`);const d=await api(source==='trending'?`/trending/${t}/week`:`/${t}/popular`,{language:'ar-SA',page:p});const rows=(d.results||[]).map(x=>row(x,t));if(rows.length)total+=await save(rows)}log(`✨ انتهى الاستيراد الجماعي: ${total} عمل.`);setPages('')}catch(e){log(`❌ ${e.message}`)}finally{setBulk(false)}
 };

 const seriesSearch=async e=>{e.preventDefault();if(!seriesQ.trim())return;setSeriesSearching(true);setSeriesResults([]);try{
   const d=/^\d+$/.test(seriesQ.trim())?{results:[await api(`/tv/${seriesQ.trim()}`,{language:'ar-SA'})]}:await api('/search/tv',{query:seriesQ.trim(),language:'ar-SA',page:1});
   setSeriesResults(d.results||[]);log(`📺 تم العثور على ${d.results?.length||0} مسلسل.`);
 }catch(e){log(`❌ ${e.message}`)}finally{setSeriesSearching(false)}};

 const seriesWithEpisodes=async x=>{const limit=Number(episodeLimit);if(!Number.isInteger(limit)||limit<1||limit>5000){log('⚠️ اكتب عدد حلقات من 1 إلى 5000.');return}setSeriesBusy(true);
   try{const detail=await api(`/tv/${x.id}`,{language:'ar-SA'});await save([row(detail,'tv')]);
     const seasons=(detail.seasons||[]).filter(s=>s.season_number>0);const eps=[];
     for(const s of seasons){if(eps.length>=limit)break;const d=await api(`/tv/${x.id}/season/${s.season_number}`,{language:'ar-SA'});for(const e of d.episodes||[]){if(eps.length>=limit)break;eps.push({...e,season_number:s.season_number)}}
     }
     /*
       The current titles schema supplied in the project has no guaranteed
       episode-parent columns. We therefore save the parent safely and only
       create episode rows when the existing titles table accepts type='episode'.
       No external "watch URL" is invented here.
     */
     if(eps.length){const rows=eps.map(e=>({tmdb_id:e.id,title:`${detail.name} - S${String(e.season_number).padStart(2,'0')}E${String(e.episode_number).padStart(2,'0')}`,type:'episode',synopsis:e.overview||'لا يوجد وصف متاح.',poster_path:e.still_path?IMG+e.still_path:(detail.poster_path?IMG+detail.poster_path:null),backdrop_path:detail.backdrop_path?`https://image.tmdb.org/t/p/w1280${detail.backdrop_path}`:null,release_year:parseInt((e.air_date||'').slice(0,4))||new Date().getFullYear(),rating_avg:Number((e.vote_average||0).toFixed(1)),is_premium:false}));try{const n=await save(rows);log(`🎬 تم حفظ المسلسل مع ${n} حلقة.`)}catch(err){log(`⚠️ تم حفظ المسلسل، لكن جدول titles الحالي رفض حفظ الحلقات: ${err.message}`)}} 
     setEpisodeLimit('');
   }catch(e){log(`❌ ${e.message}`)}finally{setSeriesBusy(false)}
 };

 const fix=async()=>{setBulk(true);try{await session();const {data,error}=await supabase.from('titles').select('*').limit(2000);if(error)throw error;let n=0;for(const x of data||[]){const d={};if(x.type==='tv')d.type='series';if(!x.title&&x.name)d.title=x.name;if(x.poster_url&&!x.poster_path)d.poster_path=x.poster_url;if(x.backdrop_url&&!x.backdrop_path)d.backdrop_path=x.backdrop_url;if(Object.keys(d).length){const {error:e}=await supabase.from('titles').update(d).eq('id',x.id);if(e)throw e;n++}}log(`✅ تم فحص ${data?.length||0} سجل وإصلاح ${n} سجل.`)}catch(e){log(`❌ فشل الفحص: ${e.message}`)}finally{setBulk(false)}};

 return <div style={S.page}><div style={S.wrap}>
  <header style={S.header}><div><div style={S.logo}>STREAM<span>FLIX</span></div><h1>🎬 مركز استيراد المحتوى</h1><p>TMDB • بحث فردي • استيراد جماعي • Trending • المسلسلات والحلقات</p></div><div style={S.badge}>⚡ ADMIN TOOL</div></header>

  <section style={S.card}><h2>🔍 البحث والاستيراد الفردي</h2><p style={S.desc}>ابحث بالاسم أو TMDB ID، شاهد البوستر والاسم والوصف ثم استورد العمل.</p>
   <form onSubmit={search} style={S.searchbar}><input value={q} onChange={e=>setQ(e.target.value)} placeholder="اسم الفيلم/المسلسل أو TMDB ID" style={S.input}/><select value={kind} onChange={e=>setKind(e.target.value)} style={S.select}><option value="movie">🎬 فيلم</option><option value="tv">📺 مسلسل</option></select><button disabled={searching} style={S.red}>{searching?'⏳ بحث...':'🔎 بحث'}</button></form>
   <div style={S.grid}>{results.map(x=><article key={x.id} style={S.result}><div style={S.poster}>{x.poster_path?<img src={IMG+x.poster_path} alt="" style={S.img}/>:<span>🎬</span>}</div><div style={S.body}><h3>{x.title||x.name}</h3><small>TMDB {x.id} • {kind==='movie'?'فيلم':'مسلسل'}</small><p>{x.overview||'لا يوجد وصف.'}</p><button onClick={()=>single(x)} style={S.green}>➕ استيراد</button></div></article>)}</div>
  </section>

  <section style={S.card}><h2>⚡ الاستيراد الجماعي</h2><p style={S.desc}>الخانة تبدأ فارغة. اكتب عدد الصفحات واختر أفلام أو مسلسلات أو الاثنين، ثم Popular أو Trending.</p>
   <div style={S.controls}><label>عدد الصفحات<input type="number" min="1" max="30" value={pages} placeholder="مثال: 5" onChange={e=>setPages(e.target.value.replace(/\D/g,''))} style={S.input}/></label><label>النوع<select value={bulkKind} onChange={e=>setBulkKind(e.target.value)} style={S.select}><option value="both">🎬📺 الاثنين</option><option value="movie">🎬 أفلام فقط</option><option value="tv">📺 مسلسلات فقط</option></select></label><label>المصدر<select value={source} onChange={e=>setSource(e.target.value)} style={S.select}><option value="popular">📦 Popular</option><option value="trending">🔥 Trending</option></select></label></div>
   <button onClick={bulkImport} disabled={bulk} style={S.big}>{bulk?'⏳ جاري الاستيراد...':'🚀 بدء الاستيراد الجماعي'}</button>
  </section>

  <section style={S.card}><h2>📺 استيراد مسلسل مع الحلقات</h2><p style={S.desc}>ابحث عن مسلسل وحدد عدد الحلقات. يتم جلب بيانات المواسم والحلقات من TMDB.</p>
   <form onSubmit={seriesSearch} style={S.searchbar}><input value={seriesQ} onChange={e=>setSeriesQ(e.target.value)} placeholder="اسم المسلسل أو TMDB ID" style={S.input}/><button disabled={seriesSearching} style={S.red}>{seriesSearching?'⏳ بحث...':'🔎 بحث'}</button></form>
   <div style={{maxWidth:260,marginTop:12}}><label>عدد الحلقات<input type="number" min="1" max="5000" value={episodeLimit} placeholder="مثال: 50" onChange={e=>setEpisodeLimit(e.target.value.replace(/\D/g,''))} style={S.input}/></label></div>
   <div style={S.grid}>{seriesResults.map(x=><article key={x.id} style={S.result}><div style={S.poster}>{x.poster_path?<img src={IMG+x.poster_path} alt="" style={S.img}/>:<span>📺</span>}</div><div style={S.body}><h3>{x.name}</h3><small>TMDB {x.id} • مسلسل</small><button onClick={()=>seriesWithEpisodes(x)} disabled={seriesBusy} style={S.purple}>{seriesBusy?'⏳ جاري...':'🎬 استيراد المسلسل + الحلقات'}</button></div></article>)}</div>
  </section>

  <section style={S.card}><div style={S.tool}><div><h2>🛠️ فحص وإصلاح URL والبيانات</h2><p style={S.desc}>يفحص السجلات ويصلح النوع وحقول الصور القديمة إذا كانت موجودة.</p></div><button onClick={fix} disabled={bulk} style={S.cyan}>{bulk?'⏳ جاري الفحص...':'🛠️ فحص وإصلاح الآن'}</button></div></section>
  <section style={S.logs}><div style={S.logHead}><h3>📋 سجل العمليات</h3><button onClick={()=>setLogs([])} style={S.clear}>مسح السجل</button></div>{logs.length?logs.map((x,i)=><div key={i}>{x}</div>):<div style={{color:'#555',padding:20,textAlign:'center'}}>لا توجد عمليات بعد.</div>}</section>
 </div></div>
}

const S={
page:{minHeight:'100vh',background:'radial-gradient(circle at top,#191919,#050505 65%)',color:'#fff',padding:20,direction:'rtl',fontFamily:'system-ui,sans-serif'},wrap:{maxWidth:1100,margin:'auto'},header:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:15,flexWrap:'wrap',paddingBottom:20},logo:{fontSize:24,fontWeight:900},'header h1':{color:'#e50914',margin:'7px 0',fontSize:27},'header p':{color:'#777',fontSize:12,margin:0},badge:{background:'#151515',border:'1px solid #333',borderRadius:999,padding:'9px 13px',fontSize:11,color:'#aaa'},card:{background:'#141414',border:'1px solid #292929',borderRadius:18,padding:20,marginBottom:18,boxShadow:'0 15px 40px #0004'},'card h2':{margin:'0 0 5px',fontSize:18},desc:{color:'#777',fontSize:12,lineHeight:1.6},searchbar:{display:'grid',gridTemplateColumns:'minmax(0,1fr) 150px 120px',gap:9},input:{width:'100%',boxSizing:'border-box',padding:12,background:'#222',border:'1px solid #3b3b3b',borderRadius:10,color:'#fff',outline:'none'},select:{width:'100%',boxSizing:'border-box',padding:12,background:'#222',border:'1px solid #3b3b3b',borderRadius:10,color:'#fff'},red:{padding:12,background:'#e50914',color:'#fff',border:0,borderRadius:10,cursor:'pointer',fontWeight:800},green:{width:'100%',padding:10,background:'#28a745',color:'#fff',border:0,borderRadius:9,cursor:'pointer',fontWeight:800},purple:{width:'100%',padding:10,background:'#7b2cbf',color:'#fff',border:0,borderRadius:9,cursor:'pointer',fontWeight:800},grid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:14,marginTop:18},result:{background:'#1b1b1b',border:'1px solid #303030',borderRadius:14,overflow:'hidden'},poster:{height:300,background:'#090909',display:'flex',alignItems:'center',justifyContent:'center',fontSize:45,color:'#555'},img:{width:'100%',height:'100%',objectFit:'cover'},body:{padding:13},'body h3':{margin:'0 0 5px',fontSize:15},'body small':{color:'#777'},'body p':{color:'#999',fontSize:11,lineHeight:1.5,minHeight:34},controls:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginTop:15},'controls label':{display:'grid',gap:7,color:'#ccc',fontSize:12},big:{width:'100%',padding:14,marginTop:15,background:'#0066cc',color:'#fff',border:0,borderRadius:11,cursor:'pointer',fontWeight:900},tool:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:15,flexWrap:'wrap'},cyan:{padding:'12px 18px',background:'#17a2b8',color:'#fff',border:0,borderRadius:10,cursor:'pointer',fontWeight:800},logs:{background:'#080808',border:'1px solid #242424',borderRadius:16,padding:16,fontFamily:'monospace',fontSize:11,color:'#00ff00',maxHeight:300,overflow:'auto'},logHead:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10},clear:{background:'transparent',border:0,color:'#777',textDecoration:'underline',cursor:'pointer'}
};
