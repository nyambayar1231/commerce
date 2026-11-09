import type { Executor } from "@commerce/db";
import { createCategory, getCategory } from "./categories.ts";
import { slugify } from "./slug.ts";

// A demo category tree for local development (`pnpm cli seed-catalog`), shaped like a Mongolian
// shop: 22 top-level categories (more than one 20-row page), several with subcategories and one
// with a third level. Safe to run again: a category whose slug already exists is skipped (its
// children are still checked). Products arrive with M2.2.

interface DemoCategory {
  name: string;
  description?: string;
  children?: DemoCategory[];
}

export const DEMO_CATEGORIES: DemoCategory[] = [
  {
    name: "Хувцас",
    description: "Эрэгтэй, эмэгтэй, хүүхдийн хувцас.",
    children: [
      {
        name: "Эрэгтэй хувцас",
        children: [{ name: "Цамц" }, { name: "Өмд" }, { name: "Хүрэм" }],
      },
      {
        name: "Эмэгтэй хувцас",
        children: [{ name: "Даашинз" }, { name: "Юбка" }, { name: "Цүнх" }],
      },
      { name: "Хүүхдийн хувцас" },
    ],
  },
  {
    name: "Гутал",
    children: [{ name: "Өвлийн гутал" }, { name: "Пүүз" }, { name: "Шаахай" }],
  },
  {
    name: "Үндэсний хувцас",
    description: "Дээл, малгай, гутал.",
    children: [{ name: "Дээл" }, { name: "Малгай" }, { name: "Монгол гутал" }],
  },
  { name: "Ноолуур", children: [{ name: "Ороолт" }, { name: "Свитер" }] },
  {
    name: "Цахилгаан бараа",
    children: [
      { name: "Гар утас" },
      { name: "Компьютер" },
      {
        name: "Гэр ахуйн цахилгаан бараа",
        children: [{ name: "Ус буцалгагч" }, { name: "Тоос сорогч" }],
      },
    ],
  },
  { name: "Гэр ахуй", children: [{ name: "Гал тогоо" }, { name: "Унтлагын өрөө" }] },
  {
    name: "Хүнс",
    children: [{ name: "Сүү, сүүн бүтээгдэхүүн" }, { name: "Мах" }, { name: "Ундаа" }],
  },
  { name: "Гоо сайхан" },
  { name: "Эрүүл мэнд" },
  { name: "Спорт" },
  { name: "Аялал, амралт" },
  { name: "Ном" },
  { name: "Бичиг хэрэг" },
  { name: "Тоглоом" },
  { name: "Хүүхдийн бараа" },
  { name: "Гэрийн тэжээвэр амьтан" },
  { name: "Цэцэг, ургамал" },
  { name: "Авто сэлбэг" },
  { name: "Барилгын материал" },
  { name: "Хөгжмийн зэмсэг" },
  { name: "Бэлэг дурсгал" },
  { name: "Гар урлал" },
];

/** Creates the demo tree; returns how many categories were created and how many already existed. */
export async function seedDemoCatalog(db: Executor): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  const seed = async (nodes: DemoCategory[], parentId?: string): Promise<void> => {
    for (const node of nodes) {
      const slug = slugify(node.name);
      let category = await getCategory(db, { slug });

      if (category) {
        skipped += 1;
      } else {
        const result = await createCategory(db, {
          name: node.name,
          slug,
          parentId,
          description: node.description
            ? { blocks: [{ type: "paragraph", data: { text: node.description } }] }
            : undefined,
        });
        if (!result.ok) {
          throw new Error(
            `Could not create ${node.name}: ${result.errors.map((e) => e.message).join(", ")}`,
          );
        }
        category = result.category;
        created += 1;
      }

      if (node.children) await seed(node.children, category.id);
    }
  };

  await seed(DEMO_CATEGORIES);

  return { created, skipped };
}
