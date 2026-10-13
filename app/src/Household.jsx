import React,{useState,useRef,useEffect} from 'react';
import {api} from './api.js';
import {Brand,Button,Icon,Spinner} from './ui.jsx';
export function Household({onJoined,onCancel}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState(null);const input=useRef(null);
 useEffect(()=>{input.current?.focus()},[]);
 async function submit(create=false){if(busy||(!create&&code.length!==4))return;setBusy(true);setError('');try{const house=await api.changeHousehold(create?null:code);if(create)setCreated(house.code);else onJoined()}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="household-page"><Brand/><section className="household-card"><Icon name="home" size={34}/><h1>{created?'Your household':'Welcome to ANY'}</h1>{created?<><p>Share this code with your household.</p><div className="household-code">{created}</div><Button tone="light" onClick={onJoined}>Continue</Button></>:<><p>Enter your household code.</p><form onSubmit={e=>{e.preventDefault();submit()}}><input ref={input} className="household-code-input" aria-label="Household code" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,4))} disabled={busy}/><Button tone="light" type="submit" disabled={busy||code.length!==4}>Join household</Button></form><Button className="household-create" onClick={()=>submit(true)} disabled={busy}>Create a household</Button>{onCancel&&<Button onClick={onCancel} disabled={busy}>Cancel</Button>}</>}{busy&&<Spinner/>}{error&&<p className="error" role="alert">{error}</p>}</section></div>
}
