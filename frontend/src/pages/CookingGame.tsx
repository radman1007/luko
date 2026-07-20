import { useNavigate, useParams } from 'react-router-dom';
import { HiOutlineChevronRight, HiOutlineWrenchScrewdriver } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { recipeById } from '@/features/home/recipes';
import styles from './CookingGame.module.css';

/**
 * بازیِ عملیِ آشپزیِ یک خوراکی.
 * TODO: برای هر خوراکی یک بازیِ HTML5 مخصوص ساخته می‌شود؛
 * وقتی آماده شد، به‌جای صفحه‌ی «به‌زودی» داخل همین قاب (iframe با sandbox) بارگذاری می‌شود.
 */
export default function CookingGame() {
  const navigate = useNavigate();
  const { recipeId = '' } = useParams();
  const chef = LUKORIANS.chef;
  const recipe = recipeById(recipeId);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate('/')}
          aria-label="بازگشت به خانه"
        >
          <HiOutlineChevronRight />
        </button>
        <span className={styles.topTitle}>آشپزخانه‌ی سرآشپز زعفران</span>
      </header>

      <section className={styles.stage}>
        <img className={styles.character} src={chef.image} alt={chef.name} />

        <div className={styles.recipeCard}>
          <p className={styles.recipeKicker}>خوراکیِ این بازی</p>
          <p className={styles.recipeName}>{recipe?.name ?? 'این خوراکی پیدا نشد!'}</p>
          {recipe && (
            <div className={styles.ingredients}>
              {recipe.ingredients.map((item) => (
                <span key={item} className={styles.chip}>
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        {recipe?.hasGame ? (
          // TODO: بازیِ واقعی این‌جا (iframe با sandbox) بارگذاری می‌شود
          <div className={styles.gameSlot} aria-label="بازی" />
        ) : (
          <div className={styles.soon}>
            <span className={styles.soonIcon} aria-hidden>
              <HiOutlineWrenchScrewdriver />
            </span>
            <p className={styles.soonTitle}>بازیِ این خوراکی به‌زودی می‌رسه!</p>
            <p className={styles.soonDesc}>
              سرآشپز زعفران داره یه بازیِ خوشمزه می‌سازه تا قدم‌به‌قدم پختنش رو یاد بگیری. یه کم صبر
              کن!
            </p>
            <button type="button" className={styles.soonBtn} onClick={() => navigate('/')}>
              برگردیم خونه
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
