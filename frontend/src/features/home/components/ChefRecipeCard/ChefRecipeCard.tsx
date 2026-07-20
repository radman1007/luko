import { useNavigate } from 'react-router-dom';
import { HiOutlinePlayCircle } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { todayRecipe } from '../../recipes';
import styles from './ChefRecipeCard.module.css';

/**
 * آشپزیِ امروز — به روایت سرآشپز زعفران.
 * هر خوراکی قرار است بازیِ عملیِ خودش را داشته باشد؛ دکمه به آن بازی می‌رود.
 */
export function ChefRecipeCard() {
  const navigate = useNavigate();
  const chef = LUKORIANS.chef;
  const recipe = todayRecipe();

  return (
    <section className={styles.card} aria-label="آشپزی امروز">
      <div className={styles.checker} aria-hidden />

      <div className={styles.head}>
        <img className={styles.character} src={chef.image} alt={chef.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>{chef.name}، {chef.role}</p>
          <p className={styles.kicker}>آشپزیِ امروز</p>
          <p className={styles.name}>{recipe.name}</p>
          <p className={styles.intro}>{recipe.intro}</p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      <div className={styles.ingredients}>
        {recipe.ingredients.map((item) => (
          <span key={item} className={styles.chip}>
            {item}
          </span>
        ))}
      </div>

      <button
        type="button"
        className={styles.gameBtn}
        onClick={() => navigate(`/cooking-game/${recipe.id}`)}
      >
        <HiOutlinePlayCircle aria-hidden />
        بیا با هم بپزیمش!
      </button>
    </section>
  );
}
