/**
 * آموزش‌های آشپزیِ سرآشپز زعفران — هر بار یک خوراکیِ تازه آموزش داده می‌شود.
 * هر خوراکی قرار است بازیِ عملیِ خودش را داشته باشد تا بچه با تمرین یاد بگیرد؛
 * تا وقتی بازیِ یک خوراکی ساخته نشده، `hasGame: false` بماند.
 * TODO: بعد از آماده شدن بک‌اند، این مقادیر از پنل ادمین خوانده و به‌روز می‌شوند.
 */
export interface Recipe {
  id: string;
  /** نام خوراکی */
  name: string;
  /** یک جمله معرفیِ کوتاه و اشتها‌آور */
  intro: string;
  /** ایموجی‌واره نه؛ نام مواد اصلی برای نمایش سریع */
  ingredients: string[];
  /** آیا بازیِ عملیِ این خوراکی آماده است؟ */
  hasGame: boolean;
}

export const RECIPES: Recipe[] = [
  {
    id: 'fruit-salad',
    name: 'سالاد میوه‌ی رنگین‌کمون',
    intro: 'یه کاسه پر از رنگ و شادی که خودت می‌تونی بسازی!',
    ingredients: ['سیب', 'موز', 'پرتقال', 'عسل'],
    hasGame: false,
  },
  {
    id: 'cheese-sandwich',
    name: 'ساندویچ پنیریِ خندان',
    intro: 'یه ساندویچ سریع و خوشمزه برای وقتی گشنته!',
    ingredients: ['نان', 'پنیر', 'گوجه', 'خیار'],
    hasGame: false,
  },
  {
    id: 'banana-milk',
    name: 'شیرموزِ جادویی',
    intro: 'نوشیدنی خنک و پرانرژی که در یک دقیقه آماده می‌شه!',
    ingredients: ['شیر', 'موز', 'عسل'],
    hasGame: false,
  },
  {
    id: 'veggie-omelet',
    name: 'املتِ سبزیجاتِ پهلوان',
    intro: 'صبحونه‌ی قوی که تو رو تا ظهر سرحال نگه می‌داره!',
    ingredients: ['تخم‌مرغ', 'گوجه', 'فلفل دلمه'],
    hasGame: false,
  },
  {
    id: 'yogurt-parfait',
    name: 'ماستِ خوشگلِ لایه‌لایه',
    intro: 'ماست و میوه و مغزها رو لایه‌لایه بچین؛ هم خوشمزه هم خوشگل!',
    ingredients: ['ماست', 'توت‌فرنگی', 'گردو', 'عسل'],
    hasGame: false,
  },
];

/** خوراکیِ امروز — بر اساس شماره‌ی روزِ سال می‌چرخد */
export function todayRecipe(): Recipe {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  return RECIPES[dayOfYear % RECIPES.length];
}

/** یافتن یک خوراکی با شناسه (برای صفحه‌ی بازی) */
export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}
