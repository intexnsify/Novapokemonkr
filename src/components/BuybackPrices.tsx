import { useAdmin } from '../pages/admin/AdminContext';
export function BuybackPrices() {
  const { draftConfig, setDraftConfig, setHasUnsavedChanges, saveDraftConfig, publishDraftToLive } = useAdmin();
  const rows = draftConfig.eventsSettings?.buybackPrices || [];
  function update(next: typeof rows) {
    setDraftConfig(prev => ({...prev,eventsSettings:{hideEndedEventsGlobally:false,...prev.eventsSettings,buybackPrices:next}}));
    setHasUnsavedChanges(true);
  }
  const valid = rows.every(r=>r.name.trim() && Number.isSafeInteger(r.price) && r.price>0);
  return <section className="p-4 space-y-3 border border-slate-600 rounded"><h2>공개 매입 기준 가격표</h2>
    {rows.map((r,i)=><div key={i} className="flex flex-wrap gap-2"><input aria-label="상품 및 조건" placeholder="상품명 · 등급 · 언어" maxLength={160} value={r.name} onChange={e=>update(rows.map((v,j)=>j===i?{...v,name:e.target.value}:v))}/><input aria-label="매입 기준가 (원)" type="number" min="1" value={r.price||''} onChange={e=>update(rows.map((v,j)=>j===i?{...v,price:Number(e.target.value)}:v))}/><button onClick={()=>update(rows.filter((_,j)=>j!==i))}>행 삭제</button></div>)}
    <div className="flex flex-wrap gap-4"><button onClick={()=>update([...rows,{name:'',price:0}])}>+ 가격 추가</button><button disabled={!valid} onClick={()=>saveDraftConfig()}>초안 저장</button><button disabled={!valid} onClick={()=>publishDraftToLive()}>사이트 설정 게시</button></div>
  </section>;
}
