'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Printer, CheckCircle } from 'lucide-react'

interface MBHREItem {
  sr_no: string
  arabic_desc: string
  unit: string
  qty: number
  rate: number
  english_desc: string
  is_header: boolean
}

interface MBHREHeader {
  date_field: string
  file_no: string
  contract_value_text: string
  owner_name: string
  contractor: string
  consultant: string
}

const DEFAULT_ITEMS: MBHREItem[] = [
  { sr_no:'1.0',  arabic_desc:'أعمال التحضيرات',                         unit:'',    qty:0, rate:0, english_desc:'Mobilisation',                          is_header:true  },
  { sr_no:'1.1',  arabic_desc:'تجهيز الموقع / مكتب / توصيل الخدمات',    unit:'L.S', qty:0, rate:0, english_desc:'Mob., Site Office & Services',           is_header:false },
  { sr_no:'2.0',  arabic_desc:'أعمال الحفر والدفان',                      unit:'',    qty:0, rate:0, english_desc:'Excavation & Back Filling',              is_header:true  },
  { sr_no:'2.1',  arabic_desc:'الحفر',                                    unit:'M3',  qty:0, rate:0, english_desc:'Excavation',                             is_header:false },
  { sr_no:'2.2',  arabic_desc:'الدفان',                                   unit:'M3',  qty:0, rate:0, english_desc:'Back Filling',                           is_header:false },
  { sr_no:'3.0',  arabic_desc:'أعمال الأساسات',                          unit:'',    qty:0, rate:0, english_desc:'Sub-Structure',                          is_header:true  },
  { sr_no:'3.1',  arabic_desc:'الفيلا',                                   unit:'M3',  qty:0, rate:0, english_desc:'Villa',                                  is_header:false },
  { sr_no:'3.2',  arabic_desc:'السور',                                    unit:'M3',  qty:0, rate:0, english_desc:'Villa Compound Wall',                    is_header:false },
  { sr_no:'3.3',  arabic_desc:'الملاحق',                                  unit:'M3',  qty:0, rate:0, english_desc:'Villa Servant Block',                    is_header:false },
  { sr_no:'4.0',  arabic_desc:'أعمال الخرسانة',                          unit:'',    qty:0, rate:0, english_desc:'Super Structure',                        is_header:true  },
  { sr_no:'4.1',  arabic_desc:'أعمدة وسقف الطابق الأرضي',               unit:'M3',  qty:0, rate:0, english_desc:'Villa GF Slab',                          is_header:false },
  { sr_no:'4.2',  arabic_desc:'أعمدة وسقف الطابق الأول',                unit:'M3',  qty:0, rate:0, english_desc:'Villa FF Slab',                          is_header:false },
  { sr_no:'4.3',  arabic_desc:'السور',                                    unit:'M3',  qty:0, rate:0, english_desc:'Compound Wall',                          is_header:false },
  { sr_no:'4.4',  arabic_desc:'أعمدة وسقف الملاحق',                     unit:'M3',  qty:0, rate:0, english_desc:'Servant Block',                          is_header:false },
  { sr_no:'5.0',  arabic_desc:'أعمال الطابوق',                           unit:'',    qty:0, rate:0, english_desc:'Block Works',                            is_header:true  },
  { sr_no:'5.1',  arabic_desc:'الطابوق المصمت للفيلا والسور والملاحق',  unit:'M2',  qty:0, rate:0, english_desc:'Solid Block (Villa, C.W., S.B.)',        is_header:false },
  { sr_no:'5.2',  arabic_desc:'الطابق الأرضي للفيلا',                   unit:'M2',  qty:0, rate:0, english_desc:'Villa GF Walls',                         is_header:false },
  { sr_no:'5.3',  arabic_desc:'الطابق الأول للفيلا',                    unit:'M2',  qty:0, rate:0, english_desc:'Villa FF Walls',                         is_header:false },
  { sr_no:'5.4',  arabic_desc:'السور',                                    unit:'M2',  qty:0, rate:0, english_desc:'Compound Wall',                          is_header:false },
  { sr_no:'5.5',  arabic_desc:'الملاحق',                                  unit:'M2',  qty:0, rate:0, english_desc:'Servant Block',                          is_header:false },
  { sr_no:'6.0',  arabic_desc:'أعمال البلاستر',                          unit:'',    qty:0, rate:0, english_desc:'Plaster Works',                          is_header:true  },
  { sr_no:'6.1',  arabic_desc:'البلاستر الداخلي للفيلا',                unit:'M2',  qty:0, rate:0, english_desc:'Villa Internal Plaster',                 is_header:false },
  { sr_no:'6.2',  arabic_desc:'البلاستر الخارجي للفيلا',                unit:'M2',  qty:0, rate:0, english_desc:'Villa External Plaster',                 is_header:false },
  { sr_no:'6.3',  arabic_desc:'بلاستر السور',                            unit:'M2',  qty:0, rate:0, english_desc:'Compound Wall',                          is_header:false },
  { sr_no:'6.4',  arabic_desc:'البلاستر الداخلي والخارجي للملاحق',      unit:'M2',  qty:0, rate:0, english_desc:'Servant Block',                          is_header:false },
  { sr_no:'7.0',  arabic_desc:'الأعمال الكهربائية',                      unit:'',    qty:0, rate:0, english_desc:'Electrical Works',                       is_header:true  },
  { sr_no:'7.1',  arabic_desc:'المواسير الكهربائية',                     unit:'L.S', qty:0, rate:0, english_desc:'Conduits',                               is_header:false },
  { sr_no:'7.2',  arabic_desc:'الأسلاك والكابلات',                       unit:'L.S', qty:0, rate:0, english_desc:'Wiring',                                 is_header:false },
  { sr_no:'7.3',  arabic_desc:'لوحات الكهرباء والمفاتيح وغيرها',        unit:'L.S', qty:0, rate:0, english_desc:'Accessories',                            is_header:false },
  { sr_no:'7.4',  arabic_desc:'المعلقات الكهربائية والمراوح',            unit:'L.S', qty:0, rate:0, english_desc:'Light Fittings & Fans',                  is_header:false },
  { sr_no:'8.0',  arabic_desc:'أعمال التمديدات الصحية الداخلية',        unit:'',    qty:0, rate:0, english_desc:'Plumbing Works (Int.)',                   is_header:true  },
  { sr_no:'8.1',  arabic_desc:'تمديدات تغذية المياه الداخلية',          unit:'L.S', qty:0, rate:0, english_desc:'Water Supply Pipes',                     is_header:false },
  { sr_no:'8.2',  arabic_desc:'تمديدات الصرف الصحي',                    unit:'L.S', qty:0, rate:0, english_desc:'Drainage Pipes',                         is_header:false },
  { sr_no:'8.3',  arabic_desc:'الأطقم الصحية وسخانات المياه',           unit:'L.S', qty:0, rate:0, english_desc:'Sanitary Wares & Water Heaters',         is_header:false },
  { sr_no:'9.0',  arabic_desc:'أعمال التمديدات الصحية الخارجية',        unit:'',    qty:0, rate:0, english_desc:'Plumbing Works (Ext.)',                   is_header:true  },
  { sr_no:'9.1',  arabic_desc:'أعمال الصرف الخارجي وغرف التفتيش',      unit:'L.S', qty:0, rate:0, english_desc:'Drainage Pipes & Manholes',               is_header:false },
  { sr_no:'9.2',  arabic_desc:'خزانات المياه والمضخات والتمديدات',      unit:'L.S', qty:0, rate:0, english_desc:'Water Tanks & Pumps',                    is_header:false },
  { sr_no:'9.3',  arabic_desc:'المرشح وخزان التحليل',                   unit:'L.S', qty:0, rate:0, english_desc:'Septic Tank and Soakaway',               is_header:false },
  { sr_no:'10.0', arabic_desc:'أعمال التشطيبات الداخلية',               unit:'',    qty:0, rate:0, english_desc:'Internal Finishes',                      is_header:true  },
  { sr_no:'10.1', arabic_desc:'الأرضيات (جميع أنواعها)',                unit:'M2',  qty:0, rate:0, english_desc:'Floor Tiles',                            is_header:false },
  { sr_no:'10.2', arabic_desc:'جدران الحمامات والمطابخ',                unit:'M2',  qty:0, rate:0, english_desc:'Wall Tiles',                             is_header:false },
  { sr_no:'10.3', arabic_desc:'الدهانات الداخلية',                       unit:'M2',  qty:0, rate:0, english_desc:'Paints',                                 is_header:false },
  { sr_no:'10.4', arabic_desc:'الرخام (السلالم + أعتاب الأبواب)',        unit:'M2',  qty:0, rate:0, english_desc:'Marble (Staircase + Threshold)',          is_header:false },
  { sr_no:'10.5', arabic_desc:'الأسقف المستعارة (الحمامات + المطابخ)',  unit:'M2',  qty:0, rate:0, english_desc:'False Ceiling (Wet Area)',                is_header:false },
  { sr_no:'10.6', arabic_desc:'أعمال الجبس والديكور',                   unit:'M2',  qty:0, rate:0, english_desc:'Gypsum Decoration Work',                 is_header:false },
  { sr_no:'11.0', arabic_desc:'أعمال التشطيبات الخارجية',               unit:'',    qty:0, rate:0, english_desc:'External Finishes',                      is_header:true  },
  { sr_no:'11.1', arabic_desc:'الدهانات الخارجية',                       unit:'M2',  qty:0, rate:0, english_desc:'Paints',                                 is_header:false },
  { sr_no:'11.2', arabic_desc:'الدهانات الخارجية للسور',                unit:'M2',  qty:0, rate:0, english_desc:'Compound Wall Paints',                   is_header:false },
  { sr_no:'11.3', arabic_desc:'الأنترلوك',                               unit:'M2',  qty:0, rate:0, english_desc:'Interlock',                              is_header:false },
  { sr_no:'11.4', arabic_desc:'الرخام الخارجي',                          unit:'M2',  qty:0, rate:0, english_desc:'Marble',                                 is_header:false },
  { sr_no:'11.5', arabic_desc:'أعمال القرميد',                           unit:'M2',  qty:0, rate:0, english_desc:'Roof Clay Tiles',                        is_header:false },
  { sr_no:'12.0', arabic_desc:'أعمال الطبقات العازلة',                   unit:'',    qty:0, rate:0, english_desc:'Water Proofing',                         is_header:true  },
  { sr_no:'12.1', arabic_desc:'عزل أساسات الفيلا والسور والملاحق',      unit:'M2',  qty:0, rate:0, english_desc:'Footings (Villa, C.W., S.B.)',            is_header:false },
  { sr_no:'12.2', arabic_desc:'الطبقات العازلة للفيلا والملاحق',        unit:'M2',  qty:0, rate:0, english_desc:'Roof',                                   is_header:false },
  { sr_no:'12.3', arabic_desc:'عزل الحمامات',                            unit:'M2',  qty:0, rate:0, english_desc:'Bathrooms',                              is_header:false },
  { sr_no:'13.0', arabic_desc:'أعمال الالمنيوم',                         unit:'',    qty:0, rate:0, english_desc:'Aluminium Works',                        is_header:true  },
  { sr_no:'13.1', arabic_desc:'الأبواب',                                  unit:'NO.', qty:0, rate:0, english_desc:'Doors',                                  is_header:false },
  { sr_no:'13.2', arabic_desc:'الشبابيك',                                 unit:'M2',  qty:0, rate:0, english_desc:'Windows',                                is_header:false },
  { sr_no:'13.3', arabic_desc:'الدرابزين',                                unit:'M2',  qty:0, rate:0, english_desc:'Handrail',                               is_header:false },
  { sr_no:'14.0', arabic_desc:'البوابات والأعمال المعدنية',              unit:'',    qty:0, rate:0, english_desc:'Gates & Metal Works',                    is_header:true  },
  { sr_no:'14.1', arabic_desc:'بوابات السور',                             unit:'L.S', qty:0, rate:0, english_desc:'Gates',                                  is_header:false },
  { sr_no:'14.2', arabic_desc:'السلم الحلزوني',                           unit:'L.S', qty:0, rate:0, english_desc:'Spiral Stair',                           is_header:false },
  { sr_no:'14.3', arabic_desc:'مظلة السيارات',                            unit:'L.S', qty:0, rate:0, english_desc:'Car Shed',                               is_header:false },
  { sr_no:'15.0', arabic_desc:'الأعمال الخشبية',                         unit:'',    qty:0, rate:0, english_desc:'Joinery Works',                          is_header:true  },
  { sr_no:'15.1', arabic_desc:'الأبواب',                                  unit:'NO.', qty:0, rate:0, english_desc:'Doors',                                  is_header:false },
  { sr_no:'15.2', arabic_desc:'خزائن المطبخ وخزائن الملابس',             unit:'L.S', qty:0, rate:0, english_desc:'Kitchen Cabinets and Wardrobes',          is_header:false },
  { sr_no:'15.3', arabic_desc:'البرجولا',                                 unit:'L.S', qty:0, rate:0, english_desc:'Pergola',                                is_header:false },
  { sr_no:'16.0', arabic_desc:'أعمال التكييف',                            unit:'',    qty:0, rate:0, english_desc:'Air Conditioning Works',                 is_header:true  },
  { sr_no:'16.1', arabic_desc:'ماكينات التكييف',                          unit:'NO.', qty:0, rate:0, english_desc:'Machines / Unit',                        is_header:false },
  { sr_no:'16.2', arabic_desc:'دكتات التكييف ومخارج الهواء',             unit:'L.S', qty:0, rate:0, english_desc:'Ducts / Diffusers',                      is_header:false },
  { sr_no:'16.3', arabic_desc:'أعمال مدنية',                              unit:'L.S', qty:0, rate:0, english_desc:'Civil Work',                             is_header:false },
  { sr_no:'17.0', arabic_desc:'أعمال النظافة والتسليم الابتدائي',        unit:'',    qty:0, rate:0, english_desc:'Cleaning, Leveling & Handing Over',      is_header:true  },
  { sr_no:'17.1', arabic_desc:'أعمال تنظيف الموقع والتسليم للبلدية',    unit:'L.S', qty:0, rate:0, english_desc:'Site Levelling, Cleaning and Handover',  is_header:false },
]

function fmt(n: number) {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function MBHREBOQInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const boqId        = searchParams.get('id')

  const [boqDbId, setBoqDbId] = useState<string | null>(boqId)
  const [header, setHeader]   = useState<MBHREHeader>({
    date_field: new Date().toLocaleDateString('en-GB'),
    file_no: '', contract_value_text: '', owner_name: '',
    contractor: 'سماء السطورة لمقاولات البناء ش.ذ.م.م', consultant: '',
  })
  const [items, setItems]     = useState<MBHREItem[]>(DEFAULT_ITEMS.map(i => ({ ...i })))
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [loading, setLoading] = useState(!!boqId)

  useEffect(() => {
    if (!boqId) { setLoading(false); return }
    fetch(`/api/boq/mbhre?id=${boqId}`)
      .then(r => r.json())
      .then(data => {
        if (data?.items) {
          setHeader({ date_field: data.date_field ?? '', file_no: data.file_no ?? '', contract_value_text: data.contract_value_text ?? '', owner_name: data.owner_name ?? '', contractor: data.contractor ?? 'سماء السطورة لمقاولات البناء ش.ذ.م.م', consultant: data.consultant ?? '' })
          const savedMap = new Map<string, MBHREItem>()
          ;(data.items as MBHREItem[]).forEach((it: MBHREItem) => savedMap.set(it.sr_no, it))
          setItems(DEFAULT_ITEMS.map(t => { const sv = savedMap.get(t.sr_no); return sv ? { ...t, qty: sv.qty, rate: sv.rate } : { ...t } }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boqId])

  const updateItem = useCallback((sr_no: string, field: 'qty' | 'rate', value: string) => {
    setItems(prev => prev.map(it => it.sr_no === sr_no ? { ...it, [field]: Number(value) } : it))
    setSaved(false)
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      let res: Response
      if (boqDbId) {
        res = await fetch('/api/boq/mbhre', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: boqDbId, ...header, items }) })
      } else {
        res = await fetch('/api/boq/mbhre', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...header, items }) })
        if (res.ok) {
          const data = await res.json()
          setBoqDbId(data.id)
          router.replace(`/estimation/boq/mbhre?id=${data.id}`, { scroll: false })
        }
      }
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Failed to save BOQ')
    } finally {
      setSaving(false)
    }
  }

  const grandTotal    = items.filter(i => !i.is_header).reduce((s, it) => s + it.qty * it.rate, 0)
  const sectionTotals = new Map<string, number>()
  let   currentSec    = ''
  items.forEach(it => {
    if (it.is_header) { currentSec = it.sr_no; sectionTotals.set(currentSec, 0) }
    else              { sectionTotals.set(currentSec, (sectionTotals.get(currentSec) ?? 0) + it.qty * it.rate) }
  })

  if (loading) return <div className="p-8 text-slate-500">Loading BOQ…</div>

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white" dir="ltr">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/estimation" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Estimation
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-semibold text-slate-700">MBHRE BOQ — جدول الكميات{boqDbId ? '' : ' — New'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save BOQ'}</>}
          </button>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 sm:p-6">
        {/* Bilingual Header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="text-center mb-5">
            <h2 className="text-lg font-bold text-slate-800">جدول الكميات</h2>
            <h2 className="text-lg font-bold text-slate-800">Bill of Quantity</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3" dir="rtl">
              {([
                { ar: 'التاريخ:',    field: 'date_field'          as const, placeholder: 'Date' },
                { ar: 'رقم الملف:', field: 'file_no'             as const, placeholder: 'File No.' },
                { ar: 'قيمة العقد:', field: 'contract_value_text' as const, placeholder: 'Contract Value (AED)' },
              ] as const).map(({ ar, field, placeholder }) => (
                <div key={field} className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                  <span className="text-xs font-bold text-slate-500 w-28 flex-shrink-0 text-right">{ar}</span>
                  <input className="flex-1 text-sm text-slate-900 bg-transparent outline-none placeholder:text-slate-300 text-right" value={header[field]} onChange={e => { setHeader(h => ({ ...h, [field]: e.target.value })); setSaved(false) }} placeholder={placeholder} />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {([
                { en: 'Owner Name:', field: 'owner_name'  as const, placeholder: 'Owner full name' },
                { en: 'Contractor:', field: 'contractor'  as const, placeholder: 'Contractor name' },
                { en: 'Consultant:', field: 'consultant'  as const, placeholder: 'Consultant name' },
              ] as const).map(({ en, field, placeholder }) => (
                <div key={field} className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                  <span className="text-xs font-bold text-slate-500 w-28 flex-shrink-0">{en}</span>
                  <input className="flex-1 text-sm text-slate-900 bg-transparent outline-none placeholder:text-slate-300" value={header[field]} onChange={e => { setHeader(h => ({ ...h, [field]: e.target.value })); setSaved(false) }} placeholder={placeholder} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOQ Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm border-collapse">
              <thead>
                <tr className="bg-slate-700 text-white" dir="rtl">
                  <th className="px-3 py-2 text-center border border-slate-600 w-16">الرقم</th>
                  <th className="px-3 py-2 text-right border border-slate-600">وصف العمل (عربي)</th>
                  <th className="px-3 py-2 text-center border border-slate-600 w-16">الكمية</th>
                  <th className="px-3 py-2 text-center border border-slate-600 w-14">الوحدة</th>
                  <th className="px-3 py-2 text-center border border-slate-600 w-22">السعر</th>
                  <th className="px-3 py-2 text-left border border-slate-600">Description (English)</th>
                  <th className="px-3 py-2 text-right border border-slate-600 w-28">القيمة / Amount</th>
                </tr>
                <tr className="bg-slate-600 text-white text-xs">
                  <th className="px-3 py-1.5 text-center border border-slate-500">Sr. No.</th>
                  <th className="px-3 py-1.5 text-right border border-slate-500" dir="rtl">Arabic Description</th>
                  <th className="px-3 py-1.5 text-center border border-slate-500">Qty</th>
                  <th className="px-3 py-1.5 text-center border border-slate-500">Unit</th>
                  <th className="px-3 py-1.5 text-center border border-slate-500">Rate</th>
                  <th className="px-3 py-1.5 text-left border border-slate-500">English Description</th>
                  <th className="px-3 py-1.5 text-right border border-slate-500">Amount (AED)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  if (item.is_header) {
                    const secTotal = sectionTotals.get(item.sr_no) ?? 0
                    return (
                      <tr key={item.sr_no} className="bg-blue-50 border-t-2 border-blue-300">
                        <td className="px-3 py-2 font-bold text-blue-800 border border-blue-200 text-center">{item.sr_no}</td>
                        <td className="px-3 py-2 font-bold text-blue-800 border border-blue-200 text-right" dir="rtl">{item.arabic_desc}</td>
                        <td colSpan={3} className="border border-blue-200" />
                        <td className="px-3 py-2 font-bold text-blue-800 border border-blue-200">{item.english_desc}</td>
                        <td className="px-3 py-2 font-bold text-blue-900 border border-blue-200 text-right">{secTotal > 0 ? fmt(secTotal) : ''}</td>
                      </tr>
                    )
                  }
                  const amount = item.qty * item.rate
                  return (
                    <tr key={item.sr_no} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-3 py-1.5 border border-slate-100 text-center font-mono text-xs text-slate-500">{item.sr_no}</td>
                      <td className="px-3 py-1.5 border border-slate-100 text-right text-slate-800" dir="rtl">{item.arabic_desc}</td>
                      <td className="px-1 py-1 border border-slate-100">
                        <input type="number" min="0" step="any" value={item.qty || ''} placeholder="0" onChange={e => updateItem(item.sr_no, 'qty', e.target.value)} className="w-full text-center text-sm font-medium bg-blue-50/60 border border-blue-100 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 print:bg-transparent print:border-0" />
                      </td>
                      <td className="px-3 py-1.5 border border-slate-100 text-center font-mono text-xs text-slate-500">{item.unit}</td>
                      <td className="px-1 py-1 border border-slate-100">
                        <input type="number" min="0" step="any" value={item.rate || ''} placeholder="0" onChange={e => updateItem(item.sr_no, 'rate', e.target.value)} className="w-full text-center text-sm font-medium bg-blue-50/60 border border-blue-100 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 print:bg-transparent print:border-0" />
                      </td>
                      <td className="px-3 py-1.5 border border-slate-100 text-slate-700">{item.english_desc}</td>
                      <td className="px-3 py-1.5 border border-slate-100 text-right font-semibold text-slate-900">{amount > 0 ? fmt(amount) : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white">
                  <td colSpan={5} className="px-4 py-3 font-bold text-right" dir="rtl">المجموع الكلي — Grand Total</td>
                  <td />
                  <td className="px-4 py-3 text-right font-bold text-lg">{fmt(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Signatures */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
          <div className="grid grid-cols-3 gap-8 mt-10">
            <div className="text-center"><div className="border-t border-slate-400 pt-2 mt-8"><p className="text-sm font-bold text-slate-700">توقيع المالك</p><p className="text-xs text-slate-500">Owner's Signature</p><p className="text-xs text-slate-400 mt-1">{header.owner_name || '___________________________'}</p></div></div>
            <div className="text-center"><div className="border-t border-slate-400 pt-2 mt-8"><p className="text-sm font-bold text-slate-700">توقيع وختم المقاول</p><p className="text-xs text-slate-500">Contractor's Stamp & Signature</p><p className="text-xs text-slate-400 mt-1">{header.contractor}</p></div></div>
            <div className="text-center"><div className="border-t border-slate-400 pt-2 mt-8"><p className="text-sm font-bold text-slate-700">توقيع وختم الاستشاري</p><p className="text-xs text-slate-500">Consultant's Stamp & Signature</p><p className="text-xs text-slate-400 mt-1">{header.consultant || '___________________________'}</p></div></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MBHREBOQPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" /></div>}>
      <MBHREBOQInner />
    </Suspense>
  )
}
