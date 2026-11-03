import { notFound } from 'next/navigation'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ id: string }> }

export default async function VerifyPage({ params }: Props) {
  const { id } = await params

  let letter: Record<string, string | null> | null = null
  try {
    const rows = await query(
      `SELECT id, ref_no, title, issued_to, issued_by, letter_date, created_at FROM hr_letters WHERE id=$1`,
      [id]
    )
    if (rows.length) letter = rows[0] as Record<string, string | null>
  } catch {}

  if (!letter) return notFound()

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-AE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

  const rows: [string, string][] = [
    ['Document Title', letter.title      || '—'],
    ['Reference No.',  letter.ref_no     || '—'],
    ['Issued To',      letter.issued_to  || '—'],
    ['Issued By',      letter.issued_by  || '—'],
    ['Letter Date',    fmtDate(letter.letter_date)],
    ['Registered On',  fmtDate(letter.created_at)],
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4f8', display:'flex', alignItems:'center', justifyContent:'center', padding:24, fontFamily:"'Segoe UI',sans-serif" }}>
      <div style={{ background:'#fff', borderRadius:16, boxShadow:'0 4px 24px rgba(0,0,0,.12)', maxWidth:520, width:'100%', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#0f3460,#1a5276)', padding:'28px 32px', color:'#fff', textAlign:'center' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginBottom:12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/letterhead.jpg" alt="" width={40} height={40} style={{ borderRadius:6, objectFit:'cover', objectPosition:'left top' }}/>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:'1rem', fontWeight:700 }}>SAMA ALOSTOURA BUILDING CONTRACTING L.L.C</div>
              <div style={{ fontSize:'.8rem', opacity:.8, marginTop:2 }}>سماء الاسطورة لمقاولات البناء ش.ذ.م.م</div>
            </div>
          </div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:999, padding:'6px 16px', fontSize:'.8rem', marginTop:8 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#22c55e', display:'inline-block' }}/>
            Document Verified — Authentic &amp; Original
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:'28px 32px' }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display:'flex', padding:'12px 0', borderBottom:'1px solid #f1f5f9', gap:12 }}>
              <span style={{ color:'#94a3b8', fontSize:'.78rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em', minWidth:110 }}>{label}</span>
              <span style={{ color:'#1e293b', fontSize:'.9rem', fontWeight:500 }}>{value}</span>
            </div>
          ))}

          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:8, padding:'12px 16px', margin:'20px 0', textAlign:'center' }}>
            <div style={{ fontSize:'.72rem', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em' }}>Verification ID</div>
            <div style={{ fontFamily:'monospace', fontSize:'1.1rem', fontWeight:700, color:'#0f3460', marginTop:4, letterSpacing:'.08em' }}>{letter.id}</div>
          </div>

          <div style={{ textAlign:'center' }}>
            <a href={'/api/hr/letters/' + letter.id + '/download'}
              style={{ display:'inline-block', padding:'10px 24px', background:'#0f3460', color:'#fff', borderRadius:8, textDecoration:'none', fontSize:'.875rem', fontWeight:600 }}>
              ⬇ Download Official PDF
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ background:'#f8fafc', borderTop:'1px solid #e2e8f0', padding:'16px 32px', textAlign:'center', fontSize:'.72rem', color:'#94a3b8' }}>
          This document was officially issued by Sama Alostoura Building Contracting L.L.C<br/>
          Dubai, UAE · Scan the QR code on the document to re-verify at any time
        </div>
      </div>
    </div>
  )
}
