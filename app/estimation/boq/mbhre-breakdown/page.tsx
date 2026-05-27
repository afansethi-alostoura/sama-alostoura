'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Printer, CheckCircle } from 'lucide-react'

interface BDItem {
  sr_no: string
  arabic_desc: string
  contract_pct: number   // fixed weight — editable, sum should = 100
  actual_pct: number     // % done — editable 0-100
  english_desc: string
  notes: string
  is_header: boolean
}

interface BDHeader {
  date_field: string
  file_no: string
  contract_value_text: string
  owner_name: string
  contractor: string
  consultant: string
}

// ── Template items from Excel ─────────────────────────────────────────────────
const DEFAULT_ITEMS: BDItem[] = [
  { sr_no:'1.0',  arabic_desc:'أعمال التحضيرات',                              contract_pct:0,     actual_pct:0, english_desc:'Mobilisation',                          notes:'', is_header:true },
  { sr_no:'1.1',  arabic_desc:'تجهيز الموقع/ مكتب /توصيل الخدمات',           contract_pct:2.42,  actual_pct:0, english_desc:'Mob.,Site office & Services.',           notes:'', is_header:false },

  { sr_no:'2.0',  arabic_desc:'أعمال الحفر والدفان',                           contract_pct:0,     actual_pct:0, english_desc:'Excavation & Back filling',              notes:'', is_header:true },
  { sr_no:'2.1',  arabic_desc:'الحفر',                                         contract_pct:1.95,  actual_pct:0, english_desc:'Excavation',                            notes:'', is_header:false },
  { sr_no:'2.2',  arabic_desc:'الدفان',                                        contract_pct:1.28,  actual_pct:0, english_desc:'Back Filling',                          notes:'', is_header:false },

  { sr_no:'3.0',  arabic_desc:'أعمال الأساسات',                                contract_pct:0,     actual_pct:0, english_desc:'Sub-structure',                         notes:'', is_header:true },
  { sr_no:'3.1',  arabic_desc:'الفيلا',                                        contract_pct:13.88, actual_pct:0, english_desc:'Villa',                                 notes:'', is_header:false },
  { sr_no:'3.2',  arabic_desc:'السور',                                         contract_pct:4.30,  actual_pct:0, english_desc:'Villa Compound wall',                   notes:'', is_header:false },
  { sr_no:'3.3',  arabic_desc:'الملاحق',                                       contract_pct:0.00,  actual_pct:0, english_desc:'Villa Servant block',                   notes:'', is_header:false },

  { sr_no:'4.0',  arabic_desc:'أعمال الخرسانة',                                contract_pct:0,     actual_pct:0, english_desc:'Super structure',                       notes:'', is_header:true },
  { sr_no:'4.1',  arabic_desc:'أعمدة وسقف الطابق الأرضي',                     contract_pct:10.27, actual_pct:0, english_desc:'Villa GF slab',                         notes:'', is_header:false },
  { sr_no:'4.2',  arabic_desc:'أعمدة وسقف الطابق الأول',                      contract_pct:11.48, actual_pct:0, english_desc:'Villa FF slab',                         notes:'', is_header:false },
  { sr_no:'4.3',  arabic_desc:'السور',                                         contract_pct:1.75,  actual_pct:0, english_desc:'Compound wall',                         notes:'', is_header:false },
  { sr_no:'4.4',  arabic_desc:'أعمدة وسقف الملاحق',                           contract_pct:0.00,  actual_pct:0, english_desc:'Servant block',                         notes:'', is_header:false },

  { sr_no:'5.0',  arabic_desc:'أعمال الطابوق',                                 contract_pct:0,     actual_pct:0, english_desc:'Block works',                           notes:'', is_header:true },
  { sr_no:'5.1',  arabic_desc:'الطابوق المصمت للفيلا والسور والملاحق',        contract_pct:2.30,  actual_pct:0, english_desc:'Solid block (Villa, C.W., S.B.)',        notes:'', is_header:false },
  { sr_no:'5.2',  arabic_desc:'الطابق الأرضي للفيلا',                         contract_pct:2.73,  actual_pct:0, english_desc:'Villa GF walls',                        notes:'', is_header:false },
  { sr_no:'5.3',  arabic_desc:'الطابق الأول للفيلا',                          contract_pct:3.47,  actual_pct:0, english_desc:'Villa FF walls',                         notes:'', is_header:false },
  { sr_no:'5.4',  arabic_desc:'السور',                                         contract_pct:1.13,  actual_pct:0, english_desc:'Compound wall',                         notes:'', is_header:false },
  { sr_no:'5.5',  arabic_desc:'الملاحق',                                       contract_pct:0.00,  actual_pct:0, english_desc:'Servant block',                         notes:'', is_header:false },

  { sr_no:'6.0',  arabic_desc:'أعمال البلاستر',                                contract_pct:0,     actual_pct:0, english_desc:'Plaster works',                         notes:'', is_header:true },
  { sr_no:'6.1',  arabic_desc:'البلاستر الداخلي للفيلا',                      contract_pct:3.21,  actual_pct:0, english_desc:'Villa Internal plaster',                notes:'', is_header:false },
  { sr_no:'6.2',  arabic_desc:'البلاستر الخارجي للفيلا',                      contract_pct:0.00,  actual_pct:0, english_desc:'Villa External plaster',                notes:'', is_header:false },
  { sr_no:'6.3',  arabic_desc:'بلاستر السور',                                  contract_pct:1.28,  actual_pct:0, english_desc:'Compound wall',                         notes:'', is_header:false },
  { sr_no:'6.4',  arabic_desc:'البلاستر الداخلي والخارجي للملاحق',            contract_pct:0.00,  actual_pct:0, english_desc:'Servant block',                         notes:'', is_header:false },

  { sr_no:'7.0',  arabic_desc:'الأعمال الكهربائية',                            contract_pct:0,     actual_pct:0, english_desc:'Electrical works',                      notes:'', is_header:true },
  { sr_no:'7.1',  arabic_desc:'المواسير الكهربائية',                           contract_pct:0.53,  actual_pct:0, english_desc:'Conduits',                              notes:'', is_header:false },
  { sr_no:'7.2',  arabic_desc:'الأسلاك والكابلات',                             contract_pct:4.00,  actual_pct:0, english_desc:'Wiring',                                notes:'', is_header:false },
  { sr_no:'7.3',  arabic_desc:'لوحات الكهرباء والمفاتيح و...الخ',             contract_pct:0.75,  actual_pct:0, english_desc:'Accessories',                           notes:'', is_header:false },
  { sr_no:'7.4',  arabic_desc:'المعلقات الكهربائية والمراوح',                  contract_pct:1.00,  actual_pct:0, english_desc:'Light fittings & fans',                 notes:'', is_header:false },

  { sr_no:'8.0',  arabic_desc:'أعمال التمديدات الصحية الداخلية',               contract_pct:0,     actual_pct:0, english_desc:'Plumbing works (int.)',                  notes:'', is_header:true },
  { sr_no:'8.1',  arabic_desc:'تمديدات تغذية المياه الداخلية',                contract_pct:0.75,  actual_pct:0, english_desc:'Water supply pipes',                    notes:'', is_header:false },
  { sr_no:'8.2',  arabic_desc:'تمديدات الصرف الصحي',                          contract_pct:0.38,  actual_pct:0, english_desc:'Drainage pipes',                        notes:'', is_header:false },
  { sr_no:'8.3',  arabic_desc:'الأطقم الصحية وسخانات المياه',                  contract_pct:1.67,  actual_pct:0, english_desc:'Sanitary wares & water heaters',        notes:'', is_header:false },

  { sr_no:'9.0',  arabic_desc:'أعمال التمديدات الصحية الخارجية',               contract_pct:0,     actual_pct:0, english_desc:'Plumbing works (ext.)',                  notes:'', is_header:true },
  { sr_no:'9.1',  arabic_desc:'أعمال الصرف الخارجي وغرف التفتيش',             contract_pct:0.75,  actual_pct:0, english_desc:'Drainage pipes & manholes',              notes:'', is_header:false },
  { sr_no:'9.2',  arabic_desc:'خزانات المياه والمضخات والتمديدات',             contract_pct:0.92,  actual_pct:0, english_desc:'Water tanks & pumps',                   notes:'', is_header:false },
  { sr_no:'9.3',  arabic_desc:'المرشح وخزان التحليل',                          contract_pct:0.00,  actual_pct:0, english_desc:'Septic tank and soakaway',               notes:'', is_header:false },

  { sr_no:'10.0', arabic_desc:'أعمال التشطيبات الداخلية',                      contract_pct:0,     actual_pct:0, english_desc:'Internal finishes',                      notes:'', is_header:true },
  { sr_no:'10.1', arabic_desc:'الأرضيات (جميع أنواعها)',                       contract_pct:1.95,  actual_pct:0, english_desc:'Floor tiles',                           notes:'', is_header:false },
  { sr_no:'10.2', arabic_desc:'جدران الحمامات والمطابخ',                       contract_pct:1.75,  actual_pct:0, english_desc:'Wall tiles',                            notes:'', is_header:false },
  { sr_no:'10.3', arabic_desc:'الدهانات الداخلية',                             contract_pct:1.95,  actual_pct:0, english_desc:'Paints',                                notes:'', is_header:false },
  { sr_no:'10.4', arabic_desc:'الرخام (السلالم + أعتاب الأبواب)',              contract_pct:0.83,  actual_pct:0, english_desc:'Marble (staircase+threshold)',            notes:'', is_header:false },
  { sr_no:'10.5', arabic_desc:'الأسقف المستعارة (الحمامات + المطابخ)',         contract_pct:0.12,  actual_pct:0, english_desc:'False ceiling (wet area)',               notes:'', is_header:false },
  { sr_no:'11.6', arabic_desc:'أعمال الجبس والديكور',                          contract_pct:1.67,  actual_pct:0, english_desc:'Gypsum decoration work',                notes:'', is_header:false },

  { sr_no:'11.0', arabic_desc:'أعمال التشطيبات الخارجية',                      contract_pct:0,     actual_pct:0, english_desc:'External finishes',                      notes:'', is_header:true },
  { sr_no:'11.1', arabic_desc:'الدهانات الخارجية',                             contract_pct:0.00,  actual_pct:0, english_desc:'Paints',                                notes:'', is_header:false },
  { sr_no:'11.2', arabic_desc:'الدهانات الخارجية للسور',                       contract_pct:1.00,  actual_pct:0, english_desc:'Compound Wall Paints',                  notes:'', is_header:false },
  { sr_no:'11.3', arabic_desc:'الأنترلوك',                                      contract_pct:0.00,  actual_pct:0, english_desc:'Interlock',                             notes:'', is_header:false },
  { sr_no:'11.4', arabic_desc:'الرخام الخارجي',                                 contract_pct:6.15,  actual_pct:0, english_desc:'Marble',                                notes:'', is_header:false },
  { sr_no:'11.5', arabic_desc:'أعمال القرميد',                                  contract_pct:0.00,  actual_pct:0, english_desc:'Roof Clay Tiles',                       notes:'', is_header:false },

  { sr_no:'12.0', arabic_desc:'أعمال الطبقات العازلة',                         contract_pct:0,     actual_pct:0, english_desc:'Water proofing',                         notes:'', is_header:true },
  { sr_no:'12.1', arabic_desc:'عزل أساسات الفيلا والسور والملاحق',            contract_pct:0.58,  actual_pct:0, english_desc:'Footings (Villa, C.W., S.B.)',            notes:'', is_header:false },
  { sr_no:'12.2', arabic_desc:'الطبقات العازلة للفيلا والملاحق',               contract_pct:1.79,  actual_pct:0, english_desc:'Roof',                                   notes:'', is_header:false },
  { sr_no:'12.3', arabic_desc:'عزل الحمامات',                                  contract_pct:0.17,  actual_pct:0, english_desc:'Bathrooms',                              notes:'', is_header:false },

  { sr_no:'13.0', arabic_desc:'أعمال الالمنيوم',                               contract_pct:0,     actual_pct:0, english_desc:'Aluminium Works',                        notes:'', is_header:true },
  { sr_no:'13.1', arabic_desc:'الأبواب',                                        contract_pct:0.50,  actual_pct:0, english_desc:'Doors',                                  notes:'', is_header:false },
  { sr_no:'13.2', arabic_desc:'الشبابيك',                                       contract_pct:4.13,  actual_pct:0, english_desc:'Windows',                               notes:'', is_header:false },
  { sr_no:'13.3', arabic_desc:'الدرابزين',                                      contract_pct:0.37,  actual_pct:0, english_desc:'Handrail',                              notes:'', is_header:false },

  { sr_no:'14.0', arabic_desc:'البوابات والأعمال المعدنية',                    contract_pct:0,     actual_pct:0, english_desc:'Gates & Metal Works',                    notes:'', is_header:true },
  { sr_no:'14.1', arabic_desc:'بوابات السور',                                   contract_pct:1.00,  actual_pct:0, english_desc:'Gates',                                  notes:'', is_header:false },
  { sr_no:'14.2', arabic_desc:'السلم الحلزوني',                                 contract_pct:0.33,  actual_pct:0, english_desc:'Spiral Stair',                           notes:'', is_header:false },
  { sr_no:'14.3', arabic_desc:'مظلة السيارات',                                  contract_pct:1.00,  actual_pct:0, english_desc:'Car Shed',                               notes:'', is_header:false },

  { sr_no:'15.0', arabic_desc:'الأعمال الخشبية',                               contract_pct:0,     actual_pct:0, english_desc:'Joinery works',                          notes:'', is_header:true },
  { sr_no:'15.1', arabic_desc:'الأبواب',                                        contract_pct:1.40,  actual_pct:0, english_desc:'Doors',                                  notes:'', is_header:false },
  { sr_no:'15.2', arabic_desc:'خزائن المطبخ وخزائن الملابس',                   contract_pct:0.00,  actual_pct:0, english_desc:'Kitchen cabinets and wardrobes',          notes:'', is_header:false },
  { sr_no:'15.3', arabic_desc:'البرجولا',                                       contract_pct:0.00,  actual_pct:0, english_desc:'Pergola',                                notes:'', is_header:false },

  { sr_no:'16.0', arabic_desc:'أعمال التكييف',                                  contract_pct:0,     actual_pct:0, english_desc:'Air conditioning works',                 notes:'', is_header:true },
  { sr_no:'16.1', arabic_desc:'ماكينات التكييف',                                contract_pct:0.00,  actual_pct:0, english_desc:'Machines/unit',                          notes:'', is_header:false },
  { sr_no:'16.2', arabic_desc:'دكتات التكييف ومخارج الهواء',                   contract_pct:0.00,  actual_pct:0, english_desc:'Ducts/diffusers',                        notes:'', is_header:false },
  { sr_no:'16.3', arabic_desc:'أعمال مدنية',                                    contract_pct:0.50,  actual_pct:0, english_desc:'Civil Work',                             notes:'', is_header:false },

  { sr_no:'17.0', arabic_desc:'أعمال النظافة والتسليم الابتدائي',               contract_pct:0,     actual_pct:0, english_desc:'Cleaning, leveling & handing over',      notes:'', is_header:true },
  { sr_no:'17.1', arabic_desc:'أعمال تنظيف الموقع والتسليم للبلدية',           contract_pct:0.62,  actual_pct:0, english_desc:'Site levelling, cleaning and H.Over.',   notes:'', is_header:false },
]

// ── Inner page (uses useSearchParams) ────────────────────────────────────────
function MBHREBreakdownInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const boqId        = searchParams.get('id')

  const [boqDbId, setBoqDbId] = useState<string | null>(boqId)
  const [header, setHeader]   = useState<BDHeader>({
    date_field: '', file_no: '', contract_value_text: '',
    owner_name: '',
    contractor: 'سماء السطورة لمقاولات البناء ش.ذ.م.م',
    consultant: '',
  })
  const [items, setItems]     = useState<BDItem[]>(DEFAULT_ITEMS.map(i => ({ ...i })))
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [loading, setLoading] = useState(!!boqId)

  // Load existing record
  useEffect(() => {
    if (!boqId) { setLoading(false); return }
    fetch(`/api/boq/mbhre-breakdown?id=${boqId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.items) {
          setHeader({
            date_field: data.date_field ?? '',
            file_no: data.file_no ?? '',
            contract_value_text: data.contract_value_text ?? '',
            owner_name: data.owner_name ?? '',
            contractor: data.contractor ?? 'سماء السطورة لمقاولات البناء ش.ذ.م.م',
            consultant: data.consultant ?? '',
          })
          const savedMap = new Map<string, BDItem>()
          ;(data.items as BDItem[]).forEach((it: BDItem) => savedMap.set(it.sr_no, it))
          setItems(DEFAULT_ITEMS.map(t => {
            const sv = savedMap.get(t.sr_no)
            return sv ? { ...t, contract_pct: sv.contract_pct, actual_pct: sv.actual_pct, notes: sv.notes } : { ...t }
          }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boqId])

  const updateItem = useCallback((sr_no: string, field: 'contract_pct' | 'actual_pct' | 'notes', value: string | number) => {
    setItems(prev => prev.map(it =>
      it.sr_no === sr_no ? { ...it, [field]: field === 'notes' ? value : Number(value) } : it
    ))
    setSaved(false)
  }, [])

  // Overall completion = Σ(contract_pct × actual_pct / 100)
  const overallCompletion = items
    .filter(it => !it.is_header)
    .reduce((sum, it) => sum + (it.contract_pct * it.actual_pct) / 100, 0)

  const totalContractPct = items
    .filter(it => !it.is_header)
    .reduce((sum, it) => sum + it.contract_pct, 0)

  async function handleSave() {
    setSaving(true)
    try {
      let res: Response
      const payload = { ...header, items }
      if (boqDbId) {
        res = await fetch('/api/boq/mbhre-breakdown', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: boqDbId, ...payload }),
        })
      } else {
        res = await fetch('/api/boq/mbhre-breakdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const data = await res.json()
          setBoqDbId(data.id)
          router.replace(`/estimation/boq/mbhre-breakdown?id=${data.id}`, { scroll: false })
        }
      }
      if (res!.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
      else alert('Save failed')
    } catch { alert('Network error') }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-purple-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* ── Toolbar ── */}
      <div className="print:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
        <Link href="/estimation" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Saved
            </span>
          )}
          {boqDbId && (
            <span className="text-xs text-slate-400 font-mono hidden sm:block">ID: {boqDbId.slice(0, 8)}…</span>
          )}
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : boqDbId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {/* ── Document ── */}
      <div className="max-w-5xl mx-auto p-4 sm:p-8 print:p-0 print:max-w-none">

        {/* Title */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
          <div className="bg-slate-800 text-white text-center py-4">
            <p className="text-xl font-bold tracking-widest" dir="rtl">جدول النسب</p>
            <p className="text-lg font-bold tracking-widest mt-0.5">Break Down</p>
          </div>

          {/* Header fields */}
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {/* Right col — Arabic */}
            <div className="space-y-2 order-2 sm:order-1" dir="rtl">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-28 shrink-0 text-right">التاريخ:</span>
                <input value={header.date_field} onChange={e => setHeader(h => ({ ...h, date_field: e.target.value }))} placeholder="Date" className="flex-1 border-b border-slate-300 focus:border-purple-400 outline-none px-1 py-0.5 bg-transparent text-slate-800" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-28 shrink-0 text-right">رقم الملف:</span>
                <input value={header.file_no} onChange={e => setHeader(h => ({ ...h, file_no: e.target.value }))} placeholder="File No." className="flex-1 border-b border-slate-300 focus:border-purple-400 outline-none px-1 py-0.5 bg-transparent text-slate-800" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-28 shrink-0 text-right">قيمة العقد:</span>
                <input value={header.contract_value_text} onChange={e => setHeader(h => ({ ...h, contract_value_text: e.target.value }))} placeholder="Contract Value" className="flex-1 border-b border-slate-300 focus:border-purple-400 outline-none px-1 py-0.5 bg-transparent text-slate-800" />
              </div>
            </div>
            {/* Left col — English */}
            <div className="space-y-2 order-1 sm:order-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-32 shrink-0">Owner Name:</span>
                <input value={header.owner_name} onChange={e => setHeader(h => ({ ...h, owner_name: e.target.value }))} placeholder="Owner Name / اسم المالك" className="flex-1 border-b border-slate-300 focus:border-purple-400 outline-none px-1 py-0.5 bg-transparent text-slate-800" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-32 shrink-0">Contractor:</span>
                <input value={header.contractor} onChange={e => setHeader(h => ({ ...h, contractor: e.target.value }))} className="flex-1 border-b border-slate-300 focus:border-purple-400 outline-none px-1 py-0.5 bg-transparent text-slate-800" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 w-32 shrink-0">Consultant:</span>
                <input value={header.consultant} onChange={e => setHeader(h => ({ ...h, consultant: e.target.value }))} placeholder="Consultant / الاستشاري" className="flex-1 border-b border-slate-300 focus:border-purple-400 outline-none px-1 py-0.5 bg-transparent text-slate-800" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Overall Completion / نسبة الإنجاز الكلية</span>
            <span className="text-2xl font-bold text-purple-700">{overallCompletion.toFixed(2)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-4 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(overallCompletion, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Contract % total: <span className={Math.abs(totalContractPct - 100) > 0.5 ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>{totalContractPct.toFixed(2)}%</span>
            {Math.abs(totalContractPct - 100) > 0.5 && ' — should equal 100%'}
          </p>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2.5 text-center border border-slate-600 w-16">الرقم<br/><span className="text-xs font-normal">Sr. No.</span></th>
                  <th className="px-3 py-2.5 text-right border border-slate-600" dir="rtl">وصف العمل</th>
                  <th className="px-3 py-2.5 text-center border border-slate-600 w-24">العقد %<br/><span className="text-xs font-normal">Contract %</span></th>
                  <th className="px-3 py-2.5 text-center border border-slate-600 w-28">العمل المنجز %<br/><span className="text-xs font-normal">Actual % done</span></th>
                  <th className="px-3 py-2.5 text-left border border-slate-600">Description of work</th>
                  <th className="px-3 py-2.5 text-center border border-slate-600 w-28">الملاحظات<br/><span className="text-xs font-normal">Notes</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  if (item.is_header) {
                    return (
                      <tr key={idx} className="bg-blue-700 text-white">
                        <td className="px-3 py-2 text-center border border-blue-600 font-bold">{item.sr_no}</td>
                        <td className="px-3 py-2 text-right border border-blue-600 font-bold" dir="rtl" colSpan={2}>{item.arabic_desc}</td>
                        <td className="px-3 py-2 text-center border border-blue-600 font-bold"></td>
                        <td className="px-3 py-2 text-left border border-blue-600 font-bold" colSpan={2}>{item.english_desc}</td>
                      </tr>
                    )
                  }
                  const contribution = (item.contract_pct * item.actual_pct) / 100
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/60 hover:bg-slate-50'}>
                      <td className="px-3 py-1.5 text-center border border-slate-100 text-slate-500 text-xs">{item.sr_no}</td>
                      <td className="px-3 py-1.5 text-right border border-slate-100 text-slate-800" dir="rtl">{item.arabic_desc}</td>
                      {/* Contract % — editable */}
                      <td className="px-1 py-1 border border-slate-100 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <input
                            type="number"
                            min={0} max={100} step={0.01}
                            value={item.contract_pct || ''}
                            onChange={e => updateItem(item.sr_no, 'contract_pct', e.target.value)}
                            className="w-16 text-center bg-blue-50 border border-blue-200 rounded px-1 py-0.5 text-blue-800 text-xs focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 print:bg-transparent print:border-0"
                            placeholder="0"
                          />
                          <span className="text-slate-500 text-xs">%</span>
                        </div>
                      </td>
                      {/* Actual % done — editable */}
                      <td className="px-1 py-1 border border-slate-100 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <input
                            type="number"
                            min={0} max={100} step={1}
                            value={item.actual_pct || ''}
                            onChange={e => updateItem(item.sr_no, 'actual_pct', e.target.value)}
                            className="w-16 text-center bg-purple-50 border border-purple-200 rounded px-1 py-0.5 text-purple-800 text-xs focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-300 print:bg-transparent print:border-0"
                            placeholder="0"
                          />
                          <span className="text-slate-500 text-xs">%</span>
                        </div>
                        {contribution > 0 && (
                          <div className="text-xs text-purple-400 text-center mt-0.5">{contribution.toFixed(2)}%</div>
                        )}
                      </td>
                      <td className="px-3 py-1.5 border border-slate-100 text-slate-700">{item.english_desc}</td>
                      <td className="px-1 py-1 border border-slate-100">
                        <input
                          type="text"
                          value={item.notes}
                          onChange={e => updateItem(item.sr_no, 'notes', e.target.value)}
                          className="w-full bg-transparent border-b border-slate-200 focus:border-purple-300 outline-none px-1 py-0.5 text-xs text-slate-600"
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  )
                })}

                {/* Total row */}
                <tr className="bg-slate-800 text-white font-bold">
                  <td className="px-3 py-2.5 border border-slate-600" colSpan={1}></td>
                  <td className="px-3 py-2.5 text-right border border-slate-600" dir="rtl">المجموع</td>
                  <td className="px-3 py-2.5 text-center border border-slate-600">{totalContractPct.toFixed(2)}%</td>
                  <td className="px-3 py-2.5 text-center border border-slate-600 text-purple-300 text-base">{overallCompletion.toFixed(2)}%</td>
                  <td className="px-3 py-2.5 border border-slate-600">Total</td>
                  <td className="px-3 py-2.5 border border-slate-600"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Signatures */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-3 gap-8 mt-8">
            <div className="text-center">
              <div className="border-t border-slate-400 pt-2 mt-8">
                <p className="text-sm font-semibold text-slate-700" dir="rtl">توقيع المالك</p>
                <p className="text-xs text-slate-500">Owner's Signature</p>
                <p className="text-xs text-slate-400 mt-0.5">{header.owner_name || '___________________________'}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 pt-2 mt-8">
                <p className="text-sm font-semibold text-slate-700" dir="rtl">توقيع وختم المقاول</p>
                <p className="text-xs text-slate-500">Contractor's Stamp & Signature</p>
                <p className="text-xs text-slate-400 mt-0.5">{header.contractor}</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 pt-2 mt-8">
                <p className="text-sm font-semibold text-slate-700" dir="rtl">توقيع وختم الاستشاري</p>
                <p className="text-xs text-slate-500">Consultant's Stamp & Signature</p>
                <p className="text-xs text-slate-400 mt-0.5">{header.consultant || '___________________________'}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default function MBHREBreakdownPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-slate-200 border-t-purple-500 rounded-full animate-spin" /></div>}>
      <MBHREBreakdownInner />
    </Suspense>
  )
}
