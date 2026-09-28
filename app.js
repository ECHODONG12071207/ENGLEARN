const $=id=>document.getElementById(id);let saved=new Set(),onlySaved=false;try{const value=JSON.parse(localStorage.getItem('blueword.vocabulary.v1')||'[]');if(Array.isArray(value))saved=new Set(value.filter(x=>typeof x==='string'))}catch{};
const audio=$('audio');function notify(t){$('status').textContent=t}function persist(){try{localStorage.setItem('blueword.vocabulary.v1',JSON.stringify([...saved]))}catch{notify('浏览器未允许保存，收藏仅在本次页面打开期间有效。')}}
let wordAudio=null;
function speak(word){audio.pause();if(wordAudio)wordAudio.pause();wordAudio=new Audio('words/'+encodeURIComponent(word)+'.mp3');wordAudio.play().catch(()=>notify('单词音频未能播放，请刷新后重试。'))}

function renderCards(){const list=vocabulary.filter(v=>!onlySaved||saved.has(v.w));$('count').textContent=vocabulary.filter(v=>saved.has(v.w)).length;$('vocabCount').textContent=String(list.length).padStart(2,'0');$('empty').hidden=list.length>0;$('savedToggle').setAttribute('aria-pressed',String(onlySaved));$('cards').innerHTML=list.map(v=>`<section class="card" id="card-${v.w}"><div class="card-top"><span class="word">${v.w}</span><button class="icon sound" data-sound="${v.w}" aria-label="朗读 ${v.w}">♪</button><button class="icon ${saved.has(v.w)?'saved':''}" data-save="${v.w}" aria-label="${saved.has(v.w)?'取消收藏':'收藏'} ${v.w}" aria-pressed="${saved.has(v.w)}">${saved.has(v.w)?'★':'☆'}</button></div><p class="ipa">${v.ipa} · 美音</p><p class="definition"><span>${v.pos}</span>${v.cn}</p><p class="english-def">${v.en}</p><details><summary>词义与例句</summary><p>${v.detail}</p><blockquote>${v.example}<span>${v.translation}</span></blockquote></details></section>`).join('');}
$('paragraphs').innerHTML=sentences.map(([zh,en],i)=>`${i===15?'<h3 class="article-subhead"><span lang="en">Significance for Europe</span><span class="zh">对欧洲的意义</span></h3>':''}<section class="sentence"><span class="number">${String(i+1).padStart(2,'0')}</span><p class="en" lang="en">${en.replace(new RegExp('\\b('+vocabulary.map(v=>v.w).join('|')+')\\b','gi'),w=>`<mark role="button" tabindex="0" data-word="${w.toLowerCase()}" aria-label="查看 ${w} 释义">${w}</mark>`)}</p><p class="zh">${zh}</p></section>`).join('');
$('wordCount').textContent=sentences.map(s=>s[1]).join(' ').split(/\s+/).length+' words · 精读约 8 分钟';renderCards();
document.addEventListener('click',e=>{const b=e.target.closest('[data-save],[data-sound],[data-word]');if(!b)return;if(b.dataset.save){const w=b.dataset.save;saved.has(w)?saved.delete(w):saved.add(w);persist();renderCards()}if(b.dataset.sound)speak(b.dataset.sound);if(b.dataset.word){onlySaved=false;renderCards();const card=$('card-'+b.dataset.word);card.classList.add('selected');card.querySelector('details').open=true;card.scrollIntoView({block:'nearest'});}});
document.addEventListener('keydown',e=>{if(e.target.matches('mark')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click()}});
$('savedToggle').onclick=()=>{onlySaved=!onlySaved;renderCards();$('cards').parentElement.scrollIntoView({block:'start'})};$('translation').onchange=e=>document.body.classList.toggle('hide-zh',!e.target.checked);
const fmt=n=>!Number.isFinite(n)?'--:--':Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
const sentenceNodes=[...document.querySelectorAll('.sentence')];
const wordNodes=narration.words.map(()=>[]);
let characterOffset=0,wordCursor=0,activeWord=-1;
for(const paragraph of document.querySelectorAll('.sentence .en')){
 const walker=document.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);const nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  const fragment=document.createDocumentFragment();let group='',groupIndex=-2;
  function flush(){if(!group)return;if(groupIndex<0)fragment.append(document.createTextNode(group));else{const span=document.createElement('span');span.className='spoken-word';span.dataset.narrationWord=groupIndex;span.textContent=group;wordNodes[groupIndex].push(span);fragment.append(span);}group='';}
  for(const character of node.textContent){
   const letter=/[\p{L}\p{N}]/u.test(character);let index=-1;
   if(letter){while(wordCursor<narration.words.length-1&&characterOffset>=narration.words[wordCursor].to)wordCursor++;index=wordCursor;characterOffset++;}
   else if(/[’'-]/.test(character))index=wordCursor;
   if(index!==groupIndex){flush();groupIndex=index;}group+=character;
  }
  flush();node.replaceWith(fragment);
 }
}
function updateWord(time){
 let low=0,high=narration.words.length-1,found=-1;
 while(low<=high){const mid=(low+high)>>1;if(narration.words[mid].start<=time){found=mid;low=mid+1}else high=mid-1;}
 if(found>=0&&time>=narration.words[found].end)found=-1;
 if(found===activeWord)return;
 if(activeWord>=0)wordNodes[activeWord].forEach(n=>n.classList.remove('is-speaking'));
 activeWord=found;
 if(found>=0)wordNodes[found].forEach(n=>n.classList.add('is-speaking'));
}
let activeSentence=-1, frame=0, hadPlayback=false;
const duration=()=>Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:narration.duration;
function followSentence(){
 const node=sentenceNodes[activeSentence];
 if(!node)return;
 const top=node.getBoundingClientRect().top+window.scrollY-document.querySelector('.player').getBoundingClientRect().height-24;
 window.scrollTo({top:Math.max(0,top),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function updateReading(force=false){
 const time=audio.currentTime;
 updateWord(time);
 $('time').textContent=fmt(time);$('duration').textContent=fmt(duration());
 $('seek').value=duration()?time/duration()*100:0;
 $('seek').setAttribute('aria-valuetext',fmt(time)+' / '+fmt(duration()));
 let index=-1;
 if(hadPlayback||time>0){
  index=0;
  for(const item of narration.sentences){if(time>=item.start)index=item.index;else break;}
 }
 if(index!==activeSentence){
  if(sentenceNodes[activeSentence]){sentenceNodes[activeSentence].classList.remove('is-reading');sentenceNodes[activeSentence].removeAttribute('aria-current');}
  activeSentence=index;
  if(sentenceNodes[index]){sentenceNodes[index].classList.add('is-reading');sentenceNodes[index].setAttribute('aria-current','true');}
  if(!audio.paused||force)followSentence();
 }else if(force)followSentence();
}
function animate(){updateReading();if(!audio.paused&&!audio.ended)frame=requestAnimationFrame(animate);}
$('play').onclick=async()=>{if(audio.paused){if(wordAudio)wordAudio.pause();try{if(audio.ended)audio.currentTime=0;await audio.play();notify('')}catch{notify('音频未能播放，请刷新后重试。')}}else audio.pause()};
audio.addEventListener('play',()=>{hadPlayback=true;$('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暂停文章');cancelAnimationFrame(frame);updateReading(true);frame=requestAnimationFrame(animate)});
audio.addEventListener('pause',()=>{$('play').textContent='▶';$('play').setAttribute('aria-label','播放文章');cancelAnimationFrame(frame);updateReading()});
for(const event of ['loadedmetadata','durationchange','timeupdate','loadeddata'])audio.addEventListener(event,()=>updateReading());
audio.addEventListener('seeked',()=>updateReading(true));
audio.addEventListener('ended',()=>{cancelAnimationFrame(frame);updateReading();$('play').textContent='↻';$('play').setAttribute('aria-label','播放文章')});
audio.addEventListener('error',()=>notify('文章音频加载失败，请刷新页面重试。'));
$('seek').oninput=e=>{if(duration()){hadPlayback=true;audio.currentTime=+e.target.value/100*duration();updateReading(true)}};
$('speed').onchange=e=>audio.playbackRate=+e.target.value;

updateReading();
