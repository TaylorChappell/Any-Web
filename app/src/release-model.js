export const validAirDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export const releaseToday=(now=Date.now())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
export function releaseDateLabel(value,now=Date.now()) {
 if(!validAirDate(value))return 'Date to be announced';
 const today=releaseToday(now),days=Math.round((Date.parse(value)-Date.parse(today))/86400000);
 if(days===0)return 'Today';if(days===1)return 'Tomorrow';
 return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short',...(days>1&&days<7?{weekday:'short'}:{}),...(value.slice(0,4)!==today.slice(0,4)?{year:'numeric'}:{})}).format(new Date(value));
}
export function episodeReleaseLabel(e,now=Date.now()) {if(!validAirDate(e.air_date))return 'Date to be announced';return e.air_date>releaseToday(now)?`Releases ${releaseDateLabel(e.air_date,now)}`:e.air_date===releaseToday(now)?'Aired today':'';}
