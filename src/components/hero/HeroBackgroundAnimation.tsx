'use client'

import { useId } from 'react'
import type { HeroBackgroundAnimationId } from '@/lib/hero/backgrounds'

interface Props {
  preset?: HeroBackgroundAnimationId | string
  paused?: boolean
  compact?: boolean
  className?: string
}

interface SceneProps { uid: string; active: boolean }

function SceneDefs({ uid }: { uid: string }) {
  return (
    <defs>
      <pattern id={`hx-grid-${uid}`} width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M48 0H0V48" fill="none" stroke="#7dd3fc" strokeOpacity=".12" strokeWidth="1" />
      </pattern>
      <pattern id={`hx-firewall-${uid}`} width="46" height="46" patternUnits="userSpaceOnUse">
        <path d="M46 0H0V46" fill="none" stroke="#67e8f9" strokeOpacity=".72" strokeWidth="2" />
        <circle cx="0" cy="0" r="4" fill="#dffaff" />
      </pattern>
      <radialGradient id={`hx-core-${uid}`}>
        <stop offset="0" stopColor="#f4feff" />
        <stop offset=".24" stopColor="#67e8f9" />
        <stop offset=".62" stopColor="#6366f1" stopOpacity=".72" />
        <stop offset="1" stopColor="#07101f" stopOpacity=".2" />
      </radialGradient>
      <linearGradient id={`hx-cyan-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e8fdff" />
        <stop offset=".38" stopColor="#38bdf8" />
        <stop offset="1" stopColor="#6366f1" />
      </linearGradient>
      <linearGradient id={`hx-green-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#d9ffe4" />
        <stop offset=".42" stopColor="#4ade80" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
      <linearGradient id={`hx-amber-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff6bf" />
        <stop offset=".45" stopColor="#fbbf24" />
        <stop offset="1" stopColor="#f97316" />
      </linearGradient>
      <filter id={`hx-glow-${uid}`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="7" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id={`hx-soft-${uid}`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="18" />
      </filter>
    </defs>
  )
}

function Stage({ uid }: { uid: string }) {
  return (
    <>
      <rect width="1600" height="900" fill="#020711" />
      <rect width="1600" height="900" fill={`url(#hx-grid-${uid})`} opacity=".48" />
      <ellipse cx="800" cy="835" rx="760" ry="170" fill="#0ea5e9" opacity=".055" />
      <ellipse cx="1180" cy="180" rx="430" ry="300" fill="#6366f1" opacity=".055" filter={`url(#hx-soft-${uid})`} />
    </>
  )
}

function TopologyScene({ uid, active }: SceneProps) {
  const nodes = [
    [120, 570, 12], [245, 410, 9], [355, 690, 8], [455, 300, 14], [565, 520, 9],
    [705, 210, 8], [790, 600, 11], [930, 370, 13], [1080, 670, 9], [1190, 250, 10],
    [1325, 510, 14], [1460, 350, 8], [1415, 720, 9], [980, 780, 7], [610, 785, 7],
  ]
  const links = [[0,1],[0,2],[1,3],[1,4],[2,4],[2,14],[3,4],[3,5],[3,6],[4,6],[4,7],[5,7],[5,9],[6,7],[6,8],[6,14],[7,8],[7,9],[7,10],[8,10],[8,13],[9,10],[9,11],[10,11],[10,12],[10,13],[11,12],[12,13],[13,14]]
  return (
    <>
      <Stage uid={uid} />
      <g className="hx-topology-camera">
        <path d="M0 760Q800 220 1600 760" fill="none" stroke="#dffaff" strokeOpacity=".11" strokeWidth="2" />
        <path d="M0 830Q800 300 1600 830" fill="none" stroke="#67e8f9" strokeOpacity=".18" strokeWidth="2" />
        {links.map(([a,b], i) => {
          const p = nodes[a]; const q = nodes[b]
          return <path key={i} d={`M${p[0]} ${p[1]} Q${(p[0]+q[0])/2} ${(p[1]+q[1])/2-28} ${q[0]} ${q[1]}`} className="hx-topology-link" stroke={i % 4 === 0 ? '#e8fdff' : '#7dd3fc'} />
        })}
        {nodes.map(([x,y,r], i) => (
          <g key={i} className="hx-topology-node" style={{ animationDelay: `${i * -.31}s` }}>
            <circle cx={x} cy={y} r={r + 18} fill="#38bdf8" opacity=".07" />
            <circle cx={x} cy={y} r={r} fill="#07101f" stroke={i % 4 === 0 ? '#f8ffff' : '#67e8f9'} strokeWidth="3" filter={`url(#hx-glow-${uid})`} />
            <circle cx={x} cy={y} r="3" fill="#fff" />
          </g>
        ))}
        <g className="hx-topology-focus" filter={`url(#hx-glow-${uid})`}>
          <circle cx="930" cy="370" r="76" fill="#38bdf8" opacity=".08" />
          <circle cx="930" cy="370" r="49" fill="#07101f" stroke="#e8fdff" strokeWidth="3" />
          <path d="M905 370c18-34 58-24 54 9-4 30-47 38-60 8 23 13 44-5 36-21-7-14-23-14-30 4Z" fill={`url(#hx-cyan-${uid})`} />
        </g>
        {active && links.filter((_,i)=>i%3===0).map(([a,b], i) => {
          const p=nodes[a]; const q=nodes[b]; const d=`M${p[0]} ${p[1]} Q${(p[0]+q[0])/2} ${(p[1]+q[1])/2-28} ${q[0]} ${q[1]}`
          return <circle key={`packet-${i}`} r="5" fill="#fff" filter={`url(#hx-glow-${uid})`}><animateMotion path={d} dur={`${2.1+i*.24}s`} begin={`${i*-.7}s`} repeatCount="indefinite" /></circle>
        })}
      </g>
    </>
  )
}

function Rack({ x, side, uid }: { x: number; side: 'left' | 'right'; uid: string }) {
  return (
    <g className="hx-rack" transform={`translate(${x} 190)`}>
      <rect width="190" height="520" rx="10" fill="#07101f" stroke="#7dd3fc" strokeOpacity=".35" strokeWidth="3" />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i} transform={`translate(14 ${20 + i * 54})`}>
          <rect width="162" height="38" rx="4" fill="#0c1727" stroke="#94a3b8" strokeOpacity=".28" />
          <circle cx={side === 'left' ? 20 : 142} cy="19" r="4" fill={i > 4 ? '#4ade80' : '#38bdf8'} className="hx-rack-led" style={{ animationDelay: `${i * -.22}s` }} />
          <path d="M42 14h88M42 24h64" stroke="#67e8f9" strokeOpacity=".22" strokeWidth="4" />
        </g>
      ))}
      <rect x="10" y="10" width="170" height="500" rx="8" fill="#4ade80" opacity=".04" className="hx-rack-activation" filter={`url(#hx-glow-${uid})`} />
    </g>
  )
}

function AnsibleScene({ uid }: SceneProps) {
  const paths = ['M800 390C650 280 520 240 350 280','M800 390C650 370 520 420 350 450','M800 390C650 500 520 600 350 620','M800 390C950 280 1080 240 1250 280','M800 390C950 370 1080 420 1250 450','M800 390C950 500 1080 600 1250 620']
  return (
    <>
      <Stage uid={uid} />
      <Rack x={120} side="left" uid={uid} /><Rack x={1290} side="right" uid={uid} />
      <g className="hx-ansible-core" filter={`url(#hx-glow-${uid})`}>
        <polygon points="800,285 900,345 900,455 800,515 700,455 700,345" fill="#07101f" stroke="#e8fdff" strokeWidth="3" />
        <polygon points="800,315 868,355 868,435 800,475 732,435 732,355" fill="#38bdf8" opacity=".18" stroke="#7dd3fc" strokeWidth="2" />
        <circle cx="800" cy="395" r="22" fill="#fff" />
      </g>
      <g className="hx-deploy-streams" filter={`url(#hx-glow-${uid})`}>
        {paths.map((d,i)=><path key={i} d={d} fill="none" stroke={i>2?'#4ade80':'#e8fdff'} strokeWidth="4" strokeDasharray="7 13" style={{ animationDelay:`${i*-.34}s` }} />)}
      </g>
      <g opacity=".36">
        {Array.from({length:12},(_,i)=><text key={i} x={540+(i%4)*150} y={170+Math.floor(i/4)*260} fill={i>7?'#4ade80':'#c8f8ff'} fontSize="17" fontFamily="monospace">{i%2?'101101':'010010'}</text>)}
      </g>
    </>
  )
}

function GlobalRemediationScene({ uid, active }: SceneProps) {
  const arcs = ['M785 450Q620 130 350 390','M785 450Q910 100 1190 300','M785 450Q1030 310 1390 590','M785 450Q590 330 190 610','M785 450Q760 160 760 90','M785 450Q980 520 1170 710']
  return (
    <>
      <Stage uid={uid} />
      <g className="hx-world" transform="translate(70 150) skewX(-8)">
        <path d="M70 160l100-70 145 22 78 70-48 78-84 18-40 98-86-36-33-102Z" />
        <path d="M400 86l176-42 150 37 92-28 182 44 102 78-52 55-150-20-72 56-110-18-44-86-132 33-95-36Z" />
        <path d="M590 260l108-35 84 52-10 148-74 142-65-48-41-135Z" />
        <path d="M1075 440l108-28 92 59-41 72-123 10-54-57Z" />
        <path d="M300 410l72 40-20 154-54 142-51-88 17-142Z" />
      </g>
      <g className="hx-threat-arcs" filter={`url(#hx-glow-${uid})`}>
        {arcs.map((d,i)=><path key={i} d={d} fill="none" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" />)}
      </g>
      <g className="hx-resolved-arcs" filter={`url(#hx-glow-${uid})`}>
        {arcs.map((d,i)=><path key={i} d={d} fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />)}
      </g>
      {[350,1190,1390,190,760,1170].map((x,i)=><circle key={i} cx={x} cy={[390,300,590,610,90,710][i]} r="11" fill={i%2?'#38bdf8':'#fbbf24'} className="hx-world-beacon" filter={`url(#hx-glow-${uid})`} style={{animationDelay:`${i*-.45}s`}} />)}
      {active && arcs.map((d,i)=><circle key={`a${i}`} r="6" fill="#fff"><animateMotion path={d} dur={`${2.8+i*.2}s`} begin={`${i*-.53}s`} repeatCount="indefinite" /></circle>)}
      <g className="hx-code-overlay" opacity=".48" fill="#7dd3fc" fontSize="15" fontFamily="monospace">
        <text x="1040" y="150">scan --global --resolve</text><text x="1040" y="176">policy: hardened</text><text x="1040" y="202">status: verified</text>
      </g>
    </>
  )
}

function FirewallScene({ uid, active }: SceneProps) {
  const greenYs=[210,300,390,500,610,700]
  const redYs=[255,455,650]
  return (
    <>
      <Stage uid={uid} />
      <g className="hx-firewall-wall" filter={`url(#hx-glow-${uid})`}>
        <rect x="760" y="70" width="80" height="760" rx="8" fill={`url(#hx-firewall-${uid})`} stroke="#dffaff" strokeWidth="3" />
      </g>
      {greenYs.map((y,i)=><g key={y}>
        <path d={`M80 ${y}H1520`} stroke="#4ade80" strokeOpacity=".18" strokeWidth="4" />
        {active && <circle r="14" fill="#07101f" stroke="#4ade80" strokeWidth="5" filter={`url(#hx-glow-${uid})`}><animateMotion path={`M80 ${y}H1520`} dur={`${3.3+i*.18}s`} begin={`${i*-.62}s`} repeatCount="indefinite" /></circle>}
        <path d={`M805 ${y-8}l9 9 18-22`} fill="none" stroke="#4ade80" strokeWidth="6" className="hx-firewall-check" style={{animationDelay:`${i*.2}s`}} />
      </g>)}
      {redYs.map((y,i)=><g key={y}>
        <path d={`M90 ${y}H770`} stroke="#fb4d5d" strokeOpacity=".24" strokeWidth="4" />
        {active && <circle r="16" fill="#2a0910" stroke="#fb4d5d" strokeWidth="5" filter={`url(#hx-glow-${uid})`}><animateMotion path={`M90 ${y}H748`} dur={`${2.7+i*.3}s`} begin={`${i*-.9}s`} repeatCount="indefinite" /></circle>}
        <g className="hx-firewall-impact" style={{animationDelay:`${i*.83}s`}} transform={`translate(760 ${y})`}>
          <circle r="34" fill="none" stroke="#fb4d5d" strokeWidth="5" /><path d="M-18-18 18 18M18-18-18 18" stroke="#fb4d5d" strokeWidth="6" />
        </g>
      </g>)}
    </>
  )
}

function InterfaceCoreScene({ uid, active }: SceneProps) {
  const nodes=[['Cisco',800,120,'#38bdf8'],['MikroTik',1110,210,'#fbbf24'],['Linux',1285,415,'#fbbf24'],['Cloud',1160,660,'#8b8cff'],['Monitoring',820,750,'#8b8cff'],['Security',545,650,'#fb7185'],['VMware',455,390,'#4ade80']]
  const core=[800,430]
  return (
    <>
      <Stage uid={uid} />
      <g className="hx-interface-graph">
        <circle cx={core[0]} cy={core[1]} r="310" fill="none" stroke="#7dd3fc" strokeOpacity=".12" strokeDasharray="4 16" />
        <circle cx={core[0]} cy={core[1]} r="220" fill="none" stroke="#8b8cff" strokeOpacity=".16" />
        {nodes.map(([label,x,y,color],i)=>{
          const d=`M${core[0]} ${core[1]} Q${(Number(x)+core[0])/2+(i%2?55:-55)} ${(Number(y)+core[1])/2} ${x} ${y}`
          return <g key={String(label)}>
            <path d={d} fill="none" stroke={String(color)} strokeOpacity=".58" strokeWidth="3" />
            <path d={d} className="hx-interface-beam" fill="none" stroke="#fff" strokeWidth="7" filter={`url(#hx-glow-${uid})`} style={{animationDelay:`${i*-.52}s`}} />
            {active && <circle r="7" fill="#fff" filter={`url(#hx-glow-${uid})`}><animateMotion path={d} dur={`${2.4+i*.16}s`} begin={`${i*-.48}s`} repeatCount="indefinite" /></circle>}
            <g className="hx-interface-node" style={{animationDelay:`${i*-.4}s`}}>
              <circle cx={Number(x)} cy={Number(y)} r="52" fill={String(color)} opacity=".1" />
              <circle cx={Number(x)} cy={Number(y)} r="35" fill="#07101f" stroke={String(color)} strokeWidth="3" filter={`url(#hx-glow-${uid})`} />
              <text x={Number(x)} y={Number(y)+6} textAnchor="middle" fill={String(color)} fontSize="17" fontWeight="800">{label}</text>
            </g>
          </g>
        })}
        <g className="hx-interface-core" filter={`url(#hx-glow-${uid})`}>
          <circle cx={core[0]} cy={core[1]} r="105" fill="#38bdf8" opacity=".08" />
          <circle cx={core[0]} cy={core[1]} r="76" fill={`url(#hx-core-${uid})`} stroke="#fff" strokeWidth="3" />
          <circle cx={core[0]} cy={core[1]} r="42" fill="#07101f" opacity=".76" />
          <text x={core[0]} y={core[1]-2} textAnchor="middle" fill="#fff" fontSize="25" fontWeight="900">HBZ</text>
          <text x={core[0]} y={core[1]+23} textAnchor="middle" fill="#a5f3fc" fontSize="11" letterSpacing="3">CORE</text>
        </g>
      </g>
    </>
  )
}

function MonitoringScene({ uid }: SceneProps) {
  const chart='100,420 170,370 240,400 310,285 380,345 450,255 520,315 590,185 660,245'
  return (
    <>
      <Stage uid={uid} />
      <g className="hx-monitor-camera" transform="translate(110 85)">
        <rect width="1380" height="720" rx="34" fill="#050b14" stroke="#7dd3fc" strokeOpacity=".3" strokeWidth="4" />
        <rect x="42" y="42" width="760" height="410" rx="18" fill="#07101f" stroke="#38bdf8" strokeOpacity=".3" />
        <g transform="translate(60 0)"><polyline points={chart} transform="translate(0 20)" fill="none" stroke="#38bdf8" strokeWidth="7" strokeLinejoin="round" className="hx-monitor-line" filter={`url(#hx-glow-${uid})`} /></g>
        <g transform="translate(850 80)">
          <circle cx="190" cy="190" r="138" fill="#07101f" stroke="#1e293b" strokeWidth="34" />
          <circle cx="190" cy="190" r="138" fill="none" stroke="#38bdf8" strokeWidth="27" strokeLinecap="round" strokeDasharray="780 88" className="hx-monitor-gauge" filter={`url(#hx-glow-${uid})`} />
          <text x="190" y="210" textAnchor="middle" fill="#4ade80" fontSize="74" fontWeight="900">100%</text>
        </g>
        {Array.from({length:6},(_,i)=><g key={i} transform={`translate(${50+i*210} 510)`}>
          <rect width="175" height="155" rx="13" fill="#07101f" stroke="#7dd3fc" strokeOpacity=".22" />
          <path d={`M20 ${115-i*5}q35 ${-70+i*9} 66-18t69-42`} fill="none" stroke={i%2?'#4ade80':'#38bdf8'} strokeWidth="5" className="hx-monitor-mini" style={{animationDelay:`${i*-.3}s`}} />
          {Array.from({length:5},(_,j)=><rect key={j} x={20+j*28} y={125-(j*13+i*4)%72} width="14" height={(j*13+i*4)%72} fill={i%2?'#4ade80':'#38bdf8'} opacity=".45" />)}
        </g>)}
      </g>
    </>
  )
}

function RoutingScene({ uid, active }: SceneProps) {
  const hubs=[[260,250],[520,160],[800,360],[1080,170],[1330,300],[350,640],[690,690],[1050,610],[1370,680]]
  const paths=[[0,2],[1,2],[2,3],[2,4],[2,5],[2,6],[2,7],[4,8],[7,8],[5,6],[6,7]]
  return (
    <>
      <Stage uid={uid} />
      <g className="hx-routing-plane">
        <path d="M80 730 800 70l720 660-720 140Z" fill="#07101f" stroke="#7dd3fc" strokeOpacity=".24" strokeWidth="3" />
        {paths.map(([a,b],i)=>{const p=hubs[a],q=hubs[b];const d=`M${p[0]} ${p[1]} L${q[0]} ${p[1]} L${q[0]} ${q[1]}`;return <g key={i}>
          <path d={d} fill="none" stroke="#fbbf24" strokeWidth="7" className="hx-route-amber" />
          <path d={d} fill="none" stroke="#38bdf8" strokeWidth="7" className="hx-route-blue" filter={`url(#hx-glow-${uid})`} />
          {active && <circle r="7" fill="#fff"><animateMotion path={d} dur={`${2.4+i*.14}s`} begin={`${i*-.31}s`} repeatCount="indefinite" /></circle>}
        </g>})}
        {hubs.map(([x,y],i)=><g key={i} className="hx-route-node" style={{animationDelay:`${i*-.23}s`}}>
          <path d={`M${x-42} ${y+18} ${x} ${y-8} ${x+42} ${y+18} ${x} ${y+44}Z`} fill="#0c1727" stroke="#7dd3fc" strokeWidth="3" />
          <rect x={x-16} y={y-55} width="32" height="48" rx="5" fill="#07101f" stroke="#38bdf8" strokeWidth="3" />
          <circle cx={x} cy={y-31} r="7" fill="#dffaff" />
        </g>)}
        <circle cx="800" cy="360" r="100" fill="none" stroke="#38bdf8" strokeOpacity=".22" strokeWidth="4" className="hx-route-tunnel" />
      </g>
    </>
  )
}

function ServerUnit({ y, label, color, uid }: { y: number; label: string; color: string; uid: string }) {
  return <g transform={`translate(530 ${y})`}>
    <rect width="540" height="210" rx="22" fill="#080f1b" stroke={color} strokeOpacity=".55" strokeWidth="4" filter={`url(#hx-glow-${uid})`} />
    <rect x="24" y="28" width="492" height="68" rx="8" fill="#0c1727" stroke="#64748b" strokeOpacity=".4" />
    <rect x="24" y="114" width="492" height="68" rx="8" fill="#0c1727" stroke="#64748b" strokeOpacity=".4" />
    {Array.from({length:10},(_,i)=><circle key={i} cx={60+i*43} cy="148" r="6" fill={i%3===0?color:'#334155'} className="hx-server-led" style={{animationDelay:`${i*-.17}s`}} />)}
    <text x="270" y="65" textAnchor="middle" fill={color} fontSize="23" fontWeight="800">{label}</text>
  </g>
}

function FailoverScene({ uid }: SceneProps) {
  return (
    <>
      <Stage uid={uid} />
      <g className="hx-failover-stage">
        <ServerUnit y={130} label="PRIMARY" color="#38bdf8" uid={uid} />
        <ServerUnit y={500} label="BACKUP" color="#4ade80" uid={uid} />
        <g className="hx-primary-failure" transform="translate(1070 235)" filter={`url(#hx-glow-${uid})`}><circle r="52" fill="#fb4d5d" opacity=".14" /><path d="M-24-24 24 24M24-24-24 24" stroke="#fb4d5d" strokeWidth="10" /></g>
        <path d="M800 340V500" fill="none" stroke="#fbbf24" strokeWidth="9" strokeDasharray="14 18" className="hx-failover-transfer" filter={`url(#hx-glow-${uid})`} />
        <path d="M180 235H530M1070 235H1420" stroke="#38bdf8" strokeOpacity=".38" strokeWidth="8" />
        <path d="M180 605H530M1070 605H1420" stroke="#4ade80" strokeOpacity=".38" strokeWidth="8" className="hx-backup-path" />
        <ellipse cx="800" cy="720" rx="410" ry="105" fill="none" stroke="#4ade80" strokeWidth="8" className="hx-backup-ring" filter={`url(#hx-glow-${uid})`} />
      </g>
    </>
  )
}

function CloudMigrationScene({ uid, active }: SceneProps) {
  const paths=Array.from({length:18},(_,i)=>`M${390+(i%4)*24} ${520+Math.floor(i/4)*19} C${520+i*8} ${520-i*10} ${720+i*10} ${250+(i%5)*22} ${1040+(i%4)*24} ${265+(i%3)*18}`)
  return (
    <>
      <Stage uid={uid} />
      <g className="hx-migration-server" filter={`url(#hx-glow-${uid})`}>
        <path d="M230 290 420 235 500 285 305 345Z" fill="#0c1727" stroke="#7dd3fc" strokeWidth="4" />
        <path d="M305 345 500 285V650L305 710Z" fill="#07101f" stroke="#38bdf8" strokeWidth="4" />
        <path d="M230 290 305 345V710L230 650Z" fill="#0a1525" stroke="#38bdf8" strokeWidth="4" />
        {Array.from({length:6},(_,i)=><g key={i}><rect x="327" y={335+i*54} width="140" height="36" rx="4" fill="#10243a" stroke="#67e8f9" strokeOpacity=".55" /><circle cx="448" cy={353+i*54} r="5" fill="#38bdf8" /></g>)}
      </g>
      <g className="hx-cloud" filter={`url(#hx-glow-${uid})`}>
        <path d="M1000 325c10-88 145-116 194-43 87-25 155 38 147 105 65 11 91 93 40 139H962c-77-43-46-163 38-176Z" fill="#7dd3fc" fillOpacity=".15" stroke="#dffaff" strokeWidth="7" />
        <circle cx="1150" cy="420" r="82" fill="#38bdf8" opacity=".07" />
      </g>
      <g className="hx-migration-stream">
        {paths.map((d,i)=><g key={i}>
          {active && <rect width="15" height="15" rx="3" fill={i%3?'#dffaff':'#38bdf8'} filter={`url(#hx-glow-${uid})`}><animateMotion path={d} dur={`${3.2+(i%5)*.28}s`} begin={`${i*-.31}s`} repeatCount="indefinite" /></rect>}
        </g>)}
      </g>
      {Array.from({length:22},(_,i)=><circle key={i} cx={600+(i*53)%520} cy={260+(i*97)%360} r={(i%3)+2} fill="#dffaff" className="hx-cloud-particle" style={{animationDelay:`${i*-.18}s`}} />)}
    </>
  )
}

function VpnScene({ uid, active }: SceneProps) {
  const beams=[250,300,350,400,450,500,550,600,650]
  return (
    <>
      <Stage uid={uid} />
      <g className="hx-vpn-corridor">
        {beams.map((y,i)=><g key={y}>
          <path d={`M0 ${y} Q480 ${y+(i-4)*20} 800 450`} fill="none" stroke="#38bdf8" strokeOpacity=".5" strokeWidth={i%3===0?7:3} className="hx-vpn-beam" style={{animationDelay:`${i*-.19}s`}} />
          <path d={`M1600 ${y} Q1120 ${y-(i-4)*20} 800 450`} fill="none" stroke="#7dd3fc" strokeOpacity=".5" strokeWidth={i%3===0?7:3} className="hx-vpn-beam" style={{animationDelay:`${i*-.23}s`}} />
        </g>)}
        {[0,1,2,3,4].map(i=><path key={i} d={`M${80+i*120} 70V830M${1520-i*120} 70V830`} stroke="#94a3b8" strokeOpacity=".13" strokeWidth="18" />)}
        <g className="hx-vpn-gate" filter={`url(#hx-glow-${uid})`}>
          <circle cx="800" cy="450" r="150" fill="#38bdf8" opacity=".05" stroke="#7dd3fc" strokeWidth="5" />
          <circle cx="800" cy="450" r="105" fill="#07101f" stroke="#38bdf8" strokeWidth="5" strokeDasharray="12 14" />
          <path d="M800 355 864 382v66c0 72-64 108-64 108s-64-36-64-108v-66Z" fill="#38bdf8" fillOpacity=".14" stroke="#e8fdff" strokeWidth="5" />
          <path d="M777 447l17 17 37-45" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" />
        </g>
        {active && [280,380,480,580].map((y,i)=><circle key={y} r="8" fill="#fff" filter={`url(#hx-glow-${uid})`}><animateMotion path={`M30 ${y} Q520 ${y} 800 450 Q1080 ${900-y} 1570 ${900-y}`} dur={`${2.8+i*.3}s`} begin={`${i*-.7}s`} repeatCount="indefinite" /></circle>)}
      </g>
    </>
  )
}

export function HeroBackgroundAnimation({ preset, paused = false, compact = false, className = '' }: Props) {
  const uid = useId().replace(/:/g, '')
  const active = !paused
  let scene
  switch (preset) {
    case 'topology-mesh': scene = <TopologyScene uid={uid} active={active} />; break
    case 'ansible-deployment': scene = <AnsibleScene uid={uid} active={active} />; break
    case 'global-remediation': scene = <GlobalRemediationScene uid={uid} active={active} />; break
    case 'firewall-filter': scene = <FirewallScene uid={uid} active={active} />; break
    case 'interface-core': scene = <InterfaceCoreScene uid={uid} active={active} />; break
    case 'monitoring-console': scene = <MonitoringScene uid={uid} active={active} />; break
    case 'routing-fabric': scene = <RoutingScene uid={uid} active={active} />; break
    case 'server-failover': scene = <FailoverScene uid={uid} active={active} />; break
    case 'cloud-migration': scene = <CloudMigrationScene uid={uid} active={active} />; break
    case 'vpn-tunnel': scene = <VpnScene uid={uid} active={active} />; break
    default: scene = <><Stage uid={uid} /></>
  }
  return (
    <div aria-hidden data-hero-bg-animation={preset ?? 'none'} className={`hero-code-background ${paused ? 'is-paused' : ''} ${compact ? 'is-compact' : ''} ${className}`}>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="presentation">
        <SceneDefs uid={uid} />
        {scene}
      </svg>
      <span className="hero-code-background-vignette" />
    </div>
  )
}
