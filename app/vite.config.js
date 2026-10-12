import {defineConfig,loadEnv} from 'vite';

export default defineConfig(({command,mode})=>{
 const env=loadEnv(mode,process.cwd(),'VITE_');
 const token=(process.env.VITE_ANY_API_TOKEN??env.VITE_ANY_API_TOKEN??'').trim();
 if(command==='build'&&(token.length<32||/^(replace_with_|your_)/i.test(token))){
  throw new Error('Set the frontend repository Actions variable ANY_API_TOKEN to the existing Railway ANY_API_TOKEN, then rerun the Pages workflow. Local builds use VITE_ANY_API_TOKEN in .env.local.');
 }
 return {base:'./',build:{target:'es2022'},server:{port:5173,strictPort:true}};
});
