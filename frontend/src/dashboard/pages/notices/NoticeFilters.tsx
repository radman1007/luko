import { ChipFilter, DateFilter, FilterBar, SearchBox, SelectFilter } from '../../components/Filters/Filters';
import { useMeta } from '../../features/data/hooks';
import { faNum } from '../../lib/format';
import styles from '../Pages.module.css';

interface Props {
  audience: 'parents' | 'students';
  filters: Record<string, string>;
  onChange: (patch: Record<string, string>) => void;
}

const SUBS = [{ value: 'active', label: 'فعال' }, { value: 'renewal', label: 'نیاز به تمدید' }, { value: 'inactive', label: 'غیرفعال' }];
const YES_NO = [{ value: 'true', label: 'بله' }, { value: 'false', label: 'خیر' }];

/** همان فیلترهای صفحه‌ی کاربران، برای انتخابِ گیرندگان */
export function NoticeFilters({ audience, filters, onChange }: Props) {
  const meta = useMeta().data;
  const grades = (meta?.grades ?? []).map((g) => ({ value: String(g.value), label: g.label }));
  const ids = filters.ids ? filters.ids.split(',').length : 0;
  return (
    <>
      <FilterBar>
        <SearchBox value={filters.q ?? ''} onChange={(q) => onChange({ q })} placeholder="فقط کسانی که نامشان…" />
        <SelectFilter label="آخرین بازدید" value={filters.seen ?? ''} options={meta?.lastSeen ?? []} allLabel="هر زمان"
          onChange={(seen) => onChange({ seen })} />
        <SelectFilter label="سکو (۳۰ روز)" value={filters.platform ?? ''} onChange={(platform) => onChange({ platform })}
          options={[{ value: 'web', label: 'وب' }, { value: 'android', label: 'اپِ اندروید' }]} />
        <DateFilter label="عضویت از" value={filters.joined_from ?? ''} onChange={(v) => onChange({ joined_from: v })} />
        <DateFilter label="تا" value={filters.joined_to ?? ''} onChange={(v) => onChange({ joined_to: v })} />
        {audience === 'parents' && (
          <>
            <SelectFilter label="شماره تأییدشده" value={filters.verified ?? ''} options={YES_NO} onChange={(v) => onChange({ verified: v })} />
            <SelectFilter label="فرزند دارد" value={filters.has_children ?? ''} options={YES_NO} onChange={(v) => onChange({ has_children: v })} />
          </>
        )}
      </FilterBar>
      <FilterBar>
        <ChipFilter label={audience === 'parents' ? 'پایه‌ی فرزند:' : 'پایه:'} value={filters.grade ?? ''} options={grades}
          onChange={(grade) => onChange({ grade })} />
      </FilterBar>
      <FilterBar>
        <ChipFilter label={audience === 'parents' ? 'اشتراکِ فرزند:' : 'اشتراک:'} value={filters.sub ?? ''} options={SUBS}
          onChange={(sub) => onChange({ sub })} />
        {ids > 0 && (
          <span className={styles.inline}>
            <b>{faNum(ids)} کاربرِ انتخابی</b>
            <button type="button" className={styles.linkBtn} onClick={() => onChange({ ids: '' })}>برداشتن</button>
          </span>
        )}
      </FilterBar>
    </>
  );
}
