'use client'

import { useState, useEffect } from 'react'
import { Card, Btn, Input, SectionDivider, PageHeader, useToast } from '@/components/admin/ui'
import { useT } from '@/lib/admin/locale'

type VariantDef = { id: string; fa: string; en: string; thumb: React.ReactNode }

function Thumb({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="120" height="70" fill="#0a0a12"/>
      {children}
    </svg>
  )
}

const VARIANTS: VariantDef[] = [
  { id:'split', fa:'تقسیم‌شده', en:'Split', thumb:<Thumb>
    <rect x="6" y="8" width="48" height="3" rx="1.5" fill="#6366f1" opacity=".9"/>
    <rect x="6" y="15" width="60" height="8" rx="2" fill="#f1f5f9" opacity=".9"/>
    <rect x="6" y="26" width="50" height="2" rx="1" fill="#94a3b8" opacity=".6"/>
    <rect x="6" y="31" width="45" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="6" y="36" width="48" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="6" y="45" width="18" height="7" rx="3" fill="#6366f1"/>
    <rect x="27" y="45" width="16" height="7" rx="3" fill="none" stroke="#6366f1" strokeWidth="1"/>
    <circle cx="90" cy="35" r="20" fill="none" stroke="#6366f1" strokeWidth=".5" opacity=".4"/>
    <circle cx="90" cy="35" r="12" fill="none" stroke="#06b6d4" strokeWidth=".5" opacity=".3"/>
    <circle cx="90" cy="35" r="4" fill="#6366f1" opacity=".6"/>
    <circle cx="79" cy="26" r="2" fill="#06b6d4" opacity=".8"/>
    <circle cx="101" cy="28" r="2" fill="#10b981" opacity=".8"/>
    <circle cx="103" cy="44" r="2" fill="#f59e0b" opacity=".8"/>
  </Thumb> },
  { id:'minimal', fa:'مینیمال بولد', en:'Minimal Bold', thumb:<Thumb>
    <rect x="35" y="6" width="50" height="2" rx="1" fill="#94a3b8" opacity=".5"/>
    <rect x="20" y="13" width="80" height="20" rx="2" fill="#f1f5f9" opacity=".85"/>
    <rect x="30" y="36" width="60" height="10" rx="2" fill="#6366f1" opacity=".7"/>
    <rect x="42" y="50" width="36" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="30" y="56" width="60" height="1.5" rx="1" fill="#94a3b8" opacity=".25"/>
  </Thumb> },
  { id:'glass', fa:'شیشه‌ای', en:'Glassmorphism', thumb:<Thumb>
    <rect x="15" y="10" width="90" height="50" rx="6" fill="#6366f1" opacity=".08" stroke="#6366f1" strokeWidth=".5" strokeOpacity=".3"/>
    <rect x="22" y="16" width="76" height="10" rx="3" fill="#818cf8" opacity=".3"/>
    <rect x="30" y="30" width="60" height="5" rx="2" fill="#f1f5f9" opacity=".8"/>
    <rect x="35" y="38" width="50" height="2" rx="1" fill="#94a3b8" opacity=".5"/>
    <rect x="30" y="45" width="20" height="6" rx="3" fill="#6366f1" opacity=".8"/>
    <rect x="53" y="45" width="16" height="6" rx="3" fill="none" stroke="#6366f1" strokeWidth="1" strokeOpacity=".6"/>
  </Thumb> },
  { id:'terminal', fa:'ترمینال', en:'Terminal', thumb:<Thumb>
    <rect x="0" y="0" width="120" height="70" fill="#050a05"/>
    <rect x="10" y="8" width="100" height="54" rx="4" fill="#0a120a" stroke="#1a3a1a" strokeWidth="1"/>
    <circle cx="18" cy="16" r="2" fill="#ef4444" opacity=".8"/><circle cx="25" cy="16" r="2" fill="#f59e0b" opacity=".8"/><circle cx="32" cy="16" r="2" fill="#10b981" opacity=".8"/>
    <rect x="16" y="24" width="5" height="1.5" rx=".5" fill="#4ade80" opacity=".7"/>
    <rect x="23" y="24" width="35" height="1.5" rx=".5" fill="#86efac" opacity=".5"/>
    <rect x="16" y="30" width="8" height="1.5" rx=".5" fill="#4ade80" opacity=".5"/>
    <rect x="26" y="30" width="50" height="1.5" rx=".5" fill="#86efac" opacity=".4"/>
    <rect x="16" y="36" width="6" height="1.5" rx=".5" fill="#4ade80" opacity=".4"/>
    <rect x="24" y="36" width="40" height="1.5" rx=".5" fill="#86efac" opacity=".35"/>
    <rect x="16" y="46" width="30" height="6" rx="2" fill="#10b981" opacity=".8"/>
    <rect x="50" y="46" width="26" height="6" rx="2" fill="none" stroke="#4ade80" strokeWidth=".8" strokeOpacity=".6"/>
  </Thumb> },
  { id:'bento', fa:'بنتو گرید', en:'Bento Grid', thumb:<Thumb>
    <rect x="6" y="6" width="70" height="35" rx="3" fill="#111128" stroke="#2a2a3e" strokeWidth=".8"/>
    <rect x="80" y="6" width="34" height="35" rx="3" fill="#111128" stroke="#2a2a3e" strokeWidth=".8"/>
    <rect x="6" y="45" width="108" height="18" rx="3" fill="#111128" stroke="#2a2a3e" strokeWidth=".8"/>
    <rect x="12" y="14" width="40" height="8" rx="2" fill="#6366f1" opacity=".7"/>
    <rect x="12" y="25" width="55" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="12" y="30" width="45" height="2" rx="1" fill="#94a3b8" opacity=".3"/>
    <rect x="84" y="14" width="22" height="8" rx="2" fill="#06b6d4" opacity=".5"/>
    <rect x="84" y="26" width="20" height="2" rx="1" fill="#94a3b8" opacity=".35"/>
    <rect x="12" y="50" width="100" height="2" rx="1" fill="#818cf8" opacity=".35"/>
  </Thumb> },
  { id:'luxury', fa:'لوکس سینمایی', en:'Dark Luxury', thumb:<Thumb>
    <rect x="50" y="6" width="20" height="20" rx="10" fill="#1e1e3f" stroke="#6366f1" strokeWidth=".8" strokeOpacity=".6"/>
    <text x="60" y="20" textAnchor="middle" fill="#818cf8" fontSize="6" fontWeight="bold">HBZ</text>
    <rect x="25" y="30" width="70" height="8" rx="2" fill="#f1f5f9" opacity=".8"/>
    <rect x="35" y="41" width="50" height="5" rx="1.5" fill="#6366f1" opacity=".6"/>
    <rect x="20" y="50" width="80" height=".8" fill="#2a2a3e"/>
    <rect x="10" y="55" width="22" height="2" rx="1" fill="#f59e0b" opacity=".7"/>
    <rect x="35" y="55" width="22" height="2" rx="1" fill="#6366f1" opacity=".7"/>
    <rect x="60" y="55" width="22" height="2" rx="1" fill="#10b981" opacity=".7"/>
    <rect x="85" y="55" width="22" height="2" rx="1" fill="#ef4444" opacity=".7"/>
  </Thumb> },
  { id:'neon', fa:'نئون', en:'Neon Circuit', thumb:<Thumb>
    <rect x="0" y="0" width="120" height="70" fill="#050510"/>
    <rect x="0" y="0" width="50" height="70" fill="rgba(6,182,212,0.03)"/>
    <rect x="70" y="0" width="50" height="70" fill="rgba(99,102,241,0.03)"/>
    <rect x="15" y="28" width="35" height="8" rx="2" fill="#06b6d4" opacity=".15" stroke="#06b6d4" strokeWidth=".5"/>
    <rect x="70" y="28" width="35" height="8" rx="2" fill="#6366f1" opacity=".15" stroke="#6366f1" strokeWidth=".5"/>
    <text x="32" y="35" textAnchor="middle" fill="#06b6d4" fontSize="5">حسین</text>
    <text x="87" y="35" textAnchor="middle" fill="#818cf8" fontSize="5">حبیب‌آذر</text>
    <rect x="15" y="42" width="35" height="4" rx="1.5" fill="#06b6d4" opacity=".7"/>
    <rect x="70" y="42" width="35" height="4" rx="1.5" fill="#6366f1" opacity=".7"/>
    <rect x="57" y="0" width="1" height="70" fill="#2a2a3e"/>
  </Thumb> },
  { id:'magazine', fa:'مجله‌ای', en:'Magazine', thumb:<Thumb>
    <rect x="6" y="6" width="120" height="2" rx="1" fill="url(#mgGrad)"/>
    <defs><linearGradient id="mgGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#6366f1"/><stop offset="33%" stopColor="#06b6d4"/><stop offset="66%" stopColor="#10b981"/><stop offset="100%" stopColor="#f59e0b"/></linearGradient></defs>
    <rect x="6" y="12" width="65" height="50" rx="2" fill="none"/>
    <rect x="6" y="12" width="65" height="3" rx="1" fill="#94a3b8" opacity=".3"/>
    <rect x="6" y="18" width="50" height="12" rx="2" fill="#6366f1" opacity=".7"/>
    <rect x="6" y="33" width="40" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="6" y="38" width="55" height="2" rx="1" fill="#94a3b8" opacity=".3"/>
    <rect x="6" y="50" width="20" height="6" rx="3" fill="#6366f1"/><rect x="29" y="50" width="16" height="6" rx="3" fill="none" stroke="#6366f1" strokeWidth="1"/>
    <rect x="80" y="12" width="35" height="50" rx="2" fill="none"/>
    {[0,1,2,3].map(i => <g key={i}><rect x="80" y={12+i*12} width="35" height="2" rx="1" fill={['#6366f1','#ef4444','#06b6d4','#10b981'][i]} opacity=".6"/><rect x="80" y={16+i*12} width="30" height="1.5" rx=".5" fill="#2a2a3e"/></g>)}
  </Thumb> },
  { id:'centered', fa:'مرکزی کلاسیک', en:'Centered', thumb:<Thumb>
    <rect x="40" y="6" width="40" height="3" rx="1.5" fill="#6366f1" opacity=".6"/>
    <rect x="35" y="12" width="50" height="3" rx="1.5" fill="#818cf8" opacity=".4"/>
    <rect x="25" y="18" width="70" height="14" rx="2" fill="#f1f5f9" opacity=".85"/>
    <rect x="35" y="35" width="50" height="2" rx="1" fill="#94a3b8" opacity=".5"/>
    <rect x="30" y="40" width="60" height="6" rx="3" fill="#6366f1" opacity=".7"/>
    <rect x="10" y="52" width="22" height="10" rx="2" fill="#111128" stroke="#6366f1" strokeWidth=".5"/><rect x="35" y="52" width="22" height="10" rx="2" fill="#111128" stroke="#06b6d4" strokeWidth=".5"/><rect x="60" y="52" width="22" height="10" rx="2" fill="#111128" stroke="#10b981" strokeWidth=".5"/><rect x="85" y="52" width="22" height="10" rx="2" fill="#111128" stroke="#f59e0b" strokeWidth=".5"/>
  </Thumb> },
  { id:'gradient', fa:'گرادیان مش', en:'Gradient Mesh', thumb:<Thumb>
    <defs><radialGradient id="grdMsh" cx="50%" cy="40%"><stop offset="0%" stopColor="#6366f1" stopOpacity=".25"/><stop offset="50%" stopColor="#06b6d4" stopOpacity=".1"/><stop offset="100%" stopColor="#0a0a12" stopOpacity="0"/></radialGradient></defs>
    <rect x="0" y="0" width="120" height="70" fill="url(#grdMsh)"/>
    <rect x="30" y="8" width="60" height="3" rx="1.5" fill="#818cf8" opacity=".5"/>
    <rect x="20" y="15" width="80" height="12" rx="3" fill="#f1f5f9" opacity=".8"/>
    <rect x="35" y="31" width="50" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="30" y="40" width="60" height="6" rx="3" fill="#6366f1" opacity=".6"/>
    <rect x="8" y="52" width="22" height="8" rx="4" fill="#6366f1" opacity=".15" stroke="#6366f1" strokeWidth=".6"/><rect x="33" y="52" width="22" height="8" rx="4" fill="#06b6d4" opacity=".15" stroke="#06b6d4" strokeWidth=".6"/><rect x="58" y="52" width="22" height="8" rx="4" fill="#10b981" opacity=".15" stroke="#10b981" strokeWidth=".6"/><rect x="83" y="52" width="22" height="8" rx="4" fill="#f59e0b" opacity=".15" stroke="#f59e0b" strokeWidth=".6"/>
  </Thumb> },
  { id:'timeline', fa:'تایم‌لاین', en:'Timeline', thumb:<Thumb>
    <rect x="6" y="8" width="55" height="3" rx="1.5" fill="#6366f1" opacity=".7"/>
    <rect x="6" y="15" width="45" height="8" rx="2" fill="#f1f5f9" opacity=".8"/>
    <rect x="6" y="26" width="50" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="6" y="40" width="18" height="6" rx="3" fill="#6366f1"/><rect x="27" y="40" width="14" height="6" rx="3" fill="none" stroke="#6366f1" strokeWidth="1"/>
    {[0,1,2,3].map(i => <g key={i}><circle cx="74" cy={12+i*14} r="3" fill={['#6366f1','#06b6d4','#10b981','#f59e0b'][i]}/>{i<3&&<line x1="74" y1={15+i*14} x2="74" y2={23+i*14} stroke="#2a2a3e" strokeWidth="1"/>}<rect x="80" y={10+i*14} width="28" height="2" rx="1" fill="#94a3b8" opacity=".4"/><rect x="80" y={14+i*14} width="20" height="1.5" rx=".5" fill="#94a3b8" opacity=".25"/></g>)}
  </Thumb> },
  { id:'diagonal', fa:'مورب', en:'Diagonal', thumb:<Thumb>
    <defs><clipPath id="diagClip"><polygon points="55,0 120,0 120,70 45,70"/></clipPath></defs>
    <rect x="0" y="0" width="120" height="70" fill="rgba(6,182,212,0.04)" clipPath="url(#diagClip)"/>
    <rect x="6" y="10" width="50" height="3" rx="1.5" fill="#6366f1" opacity=".8"/>
    <rect x="6" y="17" width="35" height="12" rx="2" fill="#f1f5f9" opacity=".8"/>
    <rect x="6" y="33" width="45" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="6" y="45" width="18" height="6" rx="3" fill="#6366f1"/>
    <rect x="75" y="8" width="30" height="10" rx="2" fill="#6366f1" opacity=".15" stroke="#6366f1" strokeWidth=".5"/>
    <rect x="75" y="22" width="30" height="10" rx="2" fill="#06b6d4" opacity=".15" stroke="#06b6d4" strokeWidth=".5"/>
    <rect x="75" y="36" width="30" height="10" rx="2" fill="#10b981" opacity=".15" stroke="#10b981" strokeWidth=".5"/>
    <rect x="75" y="50" width="30" height="10" rx="2" fill="#f59e0b" opacity=".15" stroke="#f59e0b" strokeWidth=".5"/>
  </Thumb> },
  { id:'code', fa:'کد', en:'Code Block', thumb:<Thumb>
    <rect x="6" y="6" width="75" height="55" rx="4" fill="#070710" stroke="#1e1e2e" strokeWidth="1"/>
    <rect x="6" y="6" width="75" height="12" rx="4" fill="#111128"/><rect x="6" y="12" width="75" height="6" fill="#111128"/>
    <circle cx="16" cy="12" r="2" fill="#ef4444" opacity=".8"/><circle cx="23" cy="12" r="2" fill="#f59e0b" opacity=".8"/><circle cx="30" cy="12" r="2" fill="#10b981" opacity=".8"/>
    {[['#94a3b8',15],['#6366f1',35],['#06b6d4',45],['#f1f5f9',20],['#10b981',30],['#f59e0b',40],['#6366f1',10]].map(([col,w],i) => <rect key={i} x="14" y={22+i*5} width={w as number} height="2" rx=".8" fill={col as string} opacity=".7"/>)}
    <rect x="86" y="8" width="28" height="10" rx="2" fill="#6366f1" opacity=".5"/>
    <rect x="86" y="22" width="28" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="86" y="27" width="24" height="2" rx="1" fill="#94a3b8" opacity=".3"/>
    <rect x="86" y="38" width="14" height="5" rx="2" fill="#6366f1"/><rect x="103" y="38" width="12" height="5" rx="2" fill="none" stroke="#6366f1" strokeWidth=".8"/>
    <rect x="86" y="50" width="10" height="8" rx="1.5" fill="#111128" stroke="#6366f1" strokeWidth=".4"/><rect x="99" y="50" width="10" height="8" rx="1.5" fill="#111128" stroke="#06b6d4" strokeWidth=".4"/><rect x="112" y="50" width="10" height="8" rx="1.5" fill="#111128" stroke="#10b981" strokeWidth=".4"/>
  </Thumb> },
  { id:'portrait', fa:'پرتره', en:'Portrait', thumb:<Thumb>
    <rect x="6" y="8" width="30" height="54" rx="3" fill="#111128" stroke="#2a2a3e" strokeWidth=".8"/>
    <rect x="11" y="13" width="20" height="20" rx="10" fill="#1e1e3f" stroke="#6366f1" strokeWidth=".8" strokeOpacity=".6"/>
    <text x="21" y="26" textAnchor="middle" fill="#818cf8" fontSize="5" fontWeight="bold">HBZ</text>
    <rect x="11" y="37" width="20" height="2" rx="1" fill="#94a3b8" opacity=".5"/>
    <rect x="13" y="42" width="16" height="1.5" rx=".5" fill="#6366f1" opacity=".6"/>
    {[0,1,2,3].map(i=><rect key={i} x="11" y={46+i*5} width="20" height="3" rx="1" fill={['#6366f1','#06b6d4','#10b981','#f59e0b'][i]} opacity=".15" stroke={['#6366f1','#06b6d4','#10b981','#f59e0b'][i]} strokeWidth=".4"/>)}
    <rect x="42" y="8" width="72" height="3" rx="1.5" fill="#6366f1" opacity=".7"/>
    <rect x="42" y="15" width="60" height="12" rx="2" fill="#f1f5f9" opacity=".85"/>
    <rect x="42" y="30" width="65" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="42" y="35" width="55" height="2" rx="1" fill="#94a3b8" opacity=".3"/>
    <rect x="42" y="48" width="22" height="7" rx="3" fill="#6366f1"/><rect x="67" y="48" width="16" height="7" rx="3" fill="none" stroke="#6366f1" strokeWidth="1"/>
  </Thumb> },
  { id:'metric', fa:'متریک', en:'Big Metric', thumb:<Thumb>
    <rect x="6" y="6" width="60" height="3" rx="1.5" fill="#6366f1" opacity=".7"/>
    <rect x="6" y="12" width="40" height="8" rx="2" fill="#f1f5f9" opacity=".8"/>
    <rect x="6" y="23" width="55" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="6" y="34" width="18" height="6" rx="3" fill="#6366f1"/><rect x="27" y="34" width="14" height="6" rx="3" fill="none" stroke="#6366f1" strokeWidth="1"/>
    {[{c:'#6366f1',x:6},{c:'#06b6d4',x:35},{c:'#10b981',x:64},{c:'#f59e0b',x:93}].map((s,i)=><g key={i}><rect x={s.x} y="46" width="22" height="18" rx="3" fill="#111128" stroke={s.c} strokeWidth=".5" strokeOpacity=".4"/><rect x={s.x+3} y="50" width="12" height="5" rx="1" fill={s.c} opacity=".6"/><rect x={s.x+3} y="58" width="15" height="2" rx=".5" fill="#2a2a3e"/></g>)}
  </Thumb> },
  { id:'wave', fa:'موج', en:'Wave', thumb:<Thumb>
    <defs><linearGradient id="wvGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f1f5f9"/><stop offset="40%" stopColor="#818cf8"/><stop offset="70%" stopColor="#06b6d4"/><stop offset="100%" stopColor="#10b981"/></linearGradient></defs>
    <path d="M0,45 C30,35 60,55 90,42 C105,36 115,48 120,44 L120,70 L0,70 Z" fill="rgba(99,102,241,0.08)"/>
    <path d="M0,52 C20,44 50,58 80,50 C100,44 115,54 120,50 L120,70 L0,70 Z" fill="rgba(6,182,212,0.06)"/>
    <rect x="30" y="6" width="60" height="3" rx="1.5" fill="#94a3b8" opacity=".4"/>
    <rect x="15" y="13" width="90" height="14" rx="2" fill="url(#wvGrad)" opacity=".8"/>
    <rect x="30" y="31" width="60" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="36" y="37" width="48" height="6" rx="3" fill="#6366f1" opacity=".7"/>
  </Thumb> },
  { id:'sidebar', fa:'سایدبار', en:'Sidebar', thumb:<Thumb>
    <rect x="0" y="0" width="16" height="70" fill="#0d0d1a"/>
    <rect x="0" y="0" width="1" height="70" fill="#6366f1" opacity=".3"/>
    <rect x="4" y="8" width="8" height="8" rx="2" fill="#6366f1" opacity=".7"/>
    <rect x="6" y="25" width="4" height="25" rx="2" fill="#6366f1" opacity=".15"/>
    <rect x="24" y="8" width="55" height="3" rx="1.5" fill="#6366f1" opacity=".7"/>
    <rect x="24" y="15" width="45" height="10" rx="2" fill="#f1f5f9" opacity=".85"/>
    <rect x="24" y="29" width="50" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="24" y="34" width="42" height="2" rx="1" fill="#94a3b8" opacity=".3"/>
    <rect x="24" y="43" width="18" height="6" rx="3" fill="#6366f1"/><rect x="45" y="43" width="14" height="6" rx="3" fill="none" stroke="#6366f1" strokeWidth="1"/>
    <rect x="24" y="55" width="88" height="1" fill="#1e1e2e"/>
    {[0,1,2,3].map(i=><rect key={i} x={24+i*24} y="60" width="20" height="2" rx="1" fill={['#6366f1','#06b6d4','#10b981','#f59e0b'][i]} opacity=".5"/>)}
  </Thumb> },
  { id:'holo', fa:'هولوگرافیک', en:'Holographic', thumb:<Thumb>
    <defs><linearGradient id="holoGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#6366f1" stopOpacity=".15"/><stop offset="25%" stopColor="#06b6d4" stopOpacity=".1"/><stop offset="50%" stopColor="#10b981" stopOpacity=".1"/><stop offset="75%" stopColor="#f59e0b" stopOpacity=".1"/><stop offset="100%" stopColor="#818cf8" stopOpacity=".15"/></linearGradient></defs>
    <rect x="8" y="6" width="104" height="55" rx="6" fill="url(#holoGrad)" stroke="#6366f1" strokeWidth=".5" strokeOpacity=".3"/>
    <rect x="18" y="12" width="84" height="2" rx="1" fill="#818cf8" opacity=".4"/>
    <rect x="20" y="18" width="80" height="14" rx="2" fill="#f1f5f9" opacity=".7"/>
    <rect x="28" y="36" width="64" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="33" y="43" width="54" height="7" rx="3" fill="#6366f1" opacity=".5"/>
    <rect x="8" y="65" width="26" height="4" rx="2" fill="#6366f1" opacity=".2" stroke="#6366f1" strokeWidth=".4"/>
    <rect x="37" y="65" width="26" height="4" rx="2" fill="#06b6d4" opacity=".2" stroke="#06b6d4" strokeWidth=".4"/>
    <rect x="66" y="65" width="26" height="4" rx="2" fill="#10b981" opacity=".2" stroke="#10b981" strokeWidth=".4"/>
    <rect x="95" y="65" width="20" height="4" rx="2" fill="#f59e0b" opacity=".2" stroke="#f59e0b" strokeWidth=".4"/>
  </Thumb> },
  { id:'newspaper', fa:'روزنامه', en:'Newspaper', thumb:<Thumb>
    <rect x="6" y="6" width="108" height="1.5" fill="#f1f5f9" opacity=".6"/>
    <rect x="6" y="10" width="108" height=".5" fill="#2a2a3e"/>
    <rect x="6" y="15" width="65" height="3" rx="1.5" fill="#6366f1" opacity=".7"/>
    <rect x="6" y="21" width="52" height="14" rx="2" fill="#f1f5f9" opacity=".8"/>
    <rect x="6" y="38" width="60" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="8" y="44" width="3" height="12" rx="1.5" fill="#6366f1"/><rect x="14" y="44" width="48" height="2" rx="1" fill="#94a3b8" opacity=".3"/>
    <rect x="14" y="48" width="48" height="2" rx="1" fill="#94a3b8" opacity=".25"/>
    <rect x="6" y="57" width="18" height="6" rx="3" fill="#6366f1"/>
    <rect x="80" y="10" width="1" height="55" fill="#2a2a3e"/>
    {[0,1,2,3].map(i=><g key={i}><rect x="85" y={14+i*14} width="28" height="7" rx="1.5" fill="#111128" stroke={['#6366f1','#06b6d4','#10b981','#f59e0b'][i]} strokeWidth=".4"/><rect x="88" y={17+i*14} width="18" height="1.5" rx=".5" fill={['#6366f1','#06b6d4','#10b981','#f59e0b'][i]} opacity=".5"/></g>)}
  </Thumb> },
  { id:'cyber', fa:'سایبر گرید', en:'Cyber Grid', thumb:<Thumb>
    <rect x="0" y="0" width="120" height="70" fill="#050510"/>
    <rect x="4" y="4" width="6" height="1.5" fill="#6366f1" opacity=".6"/><rect x="4" y="4" width="1.5" height="6" fill="#6366f1" opacity=".6"/>
    <rect x="110" y="4" width="6" height="1.5" fill="#6366f1" opacity=".6"/><rect x="114.5" y="4" width="1.5" height="6" fill="#6366f1" opacity=".6"/>
    <rect x="4" y="64.5" width="6" height="1.5" fill="#6366f1" opacity=".6"/><rect x="4" y="60" width="1.5" height="6" fill="#6366f1" opacity=".6"/>
    <rect x="110" y="64.5" width="6" height="1.5" fill="#6366f1" opacity=".6"/><rect x="114.5" y="60" width="1.5" height="6" fill="#6366f1" opacity=".6"/>
    <rect x="40" y="8" width="40" height="2" rx="1" fill="#06b6d4" opacity=".5"/>
    <rect x="20" y="14" width="80" height="14" rx="2" fill="#f1f5f9" opacity=".8"/>
    <rect x="32" y="32" width="56" height="5" rx="1.5" fill="#6366f1" opacity=".3" stroke="#6366f1" strokeWidth=".6"/>
    <rect x="35" y="42" width="50" height="2" rx="1" fill="#94a3b8" opacity=".4"/>
    <rect x="30" y="50" width="60" height="6" rx="3" fill="#6366f1" opacity=".7"/>
  </Thumb> },
]

type HeroData = {
  locale: string
  badge: string; headline: string; headlineHighlight: string; subheadline: string
  ctaPrimary: string; ctaPrimaryHref: string; ctaSecondary: string; ctaSecondaryHref: string
  ctaTertiary: string; ctaTertiaryHref: string
  stat1Label: string; stat1Value: string; stat2Label: string; stat2Value: string
  stat3Label: string; stat3Value: string; stat4Label: string; stat4Value: string
}
const EMPTY: HeroData = {
  locale: 'en', badge: '', headline: '', headlineHighlight: '', subheadline: '',
  ctaPrimary: '', ctaPrimaryHref: '', ctaSecondary: '', ctaSecondaryHref: '',
  ctaTertiary: '', ctaTertiaryHref: '',
  stat1Label: '', stat1Value: '', stat2Label: '', stat2Value: '',
  stat3Label: '', stat3Value: '', stat4Label: '', stat4Value: '',
}

export function HeroEditor() {
  const t = useT()
  const [locale, setLocale] = useState<'en' | 'fa'>('en')
  const [data, setData] = useState<Record<string, HeroData>>({})
  const [saving, setSaving] = useState(false)
  const [variant, setVariant] = useState('split')
  const [variantSaving, setVariantSaving] = useState(false)
  const { toast, ToastContainer } = useToast()

  useEffect(() => {
    fetch('/api/admin/hero')
      .then((r) => r.json())
      .then((rows: HeroData[]) => {
        const map: Record<string, HeroData> = {}
        for (const r of rows) map[r.locale] = r
        setData(map)
      })
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((s: Record<string, string>) => { if (s.hero_variant) setVariant(s.hero_variant) })
  }, [])

  async function saveVariant(id: string) {
    setVariant(id)
    setVariantSaving(true)
    await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hero_variant: id }),
    })
    setVariantSaving(false)
    toast('طرح هیرو ذخیره شد', 'success')
  }

  const current = data[locale] || { ...EMPTY, locale }
  function set(k: keyof HeroData, v: string) {
    setData((d) => ({ ...d, [locale]: { ...(d[locale] || { ...EMPTY, locale }), [k]: v } }))
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/hero', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    })
    setSaving(false)
    toast(res.ok ? t('saved') : t('failed'), res.ok ? 'success' : 'error')
  }

  return (
    <>
      <ToastContainer />
      <PageHeader
        title={t('heroBadgeSec')}
        subtitle="Hero Section"
        action={
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-background border border-border overflow-hidden">
              {(['en', 'fa'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={`px-4 py-1.5 text-xs font-medium transition-colors ${locale === l ? 'bg-brand text-white' : 'text-text-secondary hover:text-white'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <Btn onClick={save} disabled={saving}>
              {saving ? t('saving') : t('heroSaveChanges')}
            </Btn>
          </div>
        }
      />

      <div className="space-y-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <SectionDivider label="انتخاب طرح هیرو / Hero Layout" />
            {variantSaving && <span className="text-xs text-text-secondary">در حال ذخیره...</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                onClick={() => saveVariant(v.id)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 text-left group ${
                  variant === v.id
                    ? 'border-brand ring-2 ring-brand/30 scale-[1.02]'
                    : 'border-border hover:border-border-strong'
                }`}
              >
                <div className="h-[70px] w-full overflow-hidden bg-background">
                  {v.thumb}
                </div>
                <div className="bg-background px-2 py-1.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-medium text-text-primary truncate">{v.fa}</p>
                    <p className="text-[9px] text-text-tertiary truncate">{v.en}</p>
                  </div>
                  {variant === v.id && (
                    <div className="w-4 h-4 bg-brand rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label={t('heroBadgeSec')} />
          <Input label={t('heroBadge')} value={current.badge || ''} onChange={(v) => set('badge', v)} placeholder="Available for Enterprise Projects" />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('heroHeadline')} value={current.headline || ''} onChange={(v) => set('headline', v)} placeholder="Infrastructure" />
            <Input label={t('heroHighlight')} value={current.headlineHighlight || ''} onChange={(v) => set('headlineHighlight', v)} placeholder="Architect" />
          </div>
          <Input label={t('heroSub')} value={current.subheadline || ''} onChange={(v) => set('subheadline', v)} multiline rows={3} placeholder="Designing, securing and automating..." />
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label={t('heroCta')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('primaryCta')} value={current.ctaPrimary || ''} onChange={(v) => set('ctaPrimary', v)} placeholder="View Projects" />
            <Input label={t('primaryCtaUrl')} value={current.ctaPrimaryHref || ''} onChange={(v) => set('ctaPrimaryHref', v)} placeholder="/projects" />
            <Input label={t('secondaryCta')} value={current.ctaSecondary || ''} onChange={(v) => set('ctaSecondary', v)} placeholder="Book Consultation" />
            <Input label={t('secondaryCtaUrl')} value={current.ctaSecondaryHref || ''} onChange={(v) => set('ctaSecondaryHref', v)} placeholder="/consultation" />
            <Input label={t('tertiaryCta')} value={current.ctaTertiary || ''} onChange={(v) => set('ctaTertiary', v)} placeholder="Download Resume" />
            <Input label={t('tertiaryCtaUrl')} value={current.ctaTertiaryHref || ''} onChange={(v) => set('ctaTertiaryHref', v)} placeholder="/resume.pdf" />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <SectionDivider label={t('heroStats')} />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="grid grid-cols-2 gap-2">
                <Input label={`${t('statValue')} ${n}`} value={(current as never)[`stat${n}Value`] || ''} onChange={(v) => set(`stat${n}Value` as keyof HeroData, v)} placeholder="10+" />
                <Input label={`${t('statLabel')} ${n}`} value={(current as never)[`stat${n}Label`] || ''} onChange={(v) => set(`stat${n}Label` as keyof HeroData, v)} placeholder="Years Experience" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
