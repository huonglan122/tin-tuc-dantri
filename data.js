/**
 * data.js - Lớp dữ liệu (LocalStorage) cho dự án báo tin tức mô phỏng Dân trí
 * Môn: Xây dựng ứng dụng Web - Đại học Phenikaa
 *
 * Cách dùng: nhúng <script src="data.js"></script> TRƯỚC các script khác.
 * Sau khi nạp, đối tượng toàn cục `DataStore` sẵn sàng sử dụng.
 */
(function (global) {
  "use strict";

  const STORAGE_KEYS = {
    MENU: "dtri_menu",
    POSTS: "dtri_posts",
    INIT_FLAG: "dtri_initialized_v1",
  };

  const DEFAULT_SOURCE = "dantri.com.vn";
  const BASE_URL = "https://dantri.com.vn";

  /* ------------------------------------------------------------------ *
   * 1. TIỆN ÍCH
   * ------------------------------------------------------------------ */

  /** Chuyển tiếng Việt có dấu -> slug không dấu, phân tách bằng dấu gạch ngang */
  function slugify(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tổ hợp
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ") // bỏ ký tự đặc biệt
      .trim()
      .replace(/[\s-]+/g, "-") // gộp khoảng trắng / gạch ngang liên tiếp
      .replace(/^-+|-+$/g, "");
  }

  const pad = (n, len = 2) => String(n).padStart(len, "0");

  /** Date -> "YYYY-MM-DD HH:mm" */
  function formatDateTime(d) {
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }

  /** Date -> "YYYYMMDDHHmmssSSS" (dùng tạo id) */
  function compactTimestamp(d) {
    return (
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${pad(d.getMilliseconds(), 3)}`
    );
  }

  function safeParse(json, fallback) {
    try {
      const v = JSON.parse(json);
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  /* ------------------------------------------------------------------ *
   * 2. MENU PHÂN CẤP (mô phỏng cấu trúc báo Dân trí)
   * ------------------------------------------------------------------ */

  function node(id, title, slug, children) {
    const item = {
      id: id,
      title: title,
      url: `${BASE_URL}/${slug}.htm`,
      type: children && children.length ? "parent" : "category",
    };
    if (children && children.length) {
      item.children = children.map((c, i) =>
        node(`${id}-${i + 1}`, c[0], c[1], null)
      );
      // chuyên mục con có type "child"
      item.children.forEach((c) => (c.type = "child"));
    }
    return item;
  }

  function buildDefaultMenu() {
    return [
      { id: "home", title: "Trang chủ", url: `${BASE_URL}/`, type: "home" },
      node("xa-hoi", "Xã hội", "xa-hoi", [
        ["Nóng trên mạng", "xa-hoi/nong-tren-mang"],
        ["Chuyện hôm nay", "xa-hoi/chuyen-hom-nay"],
        ["Môi trường", "xa-hoi/moi-truong"],
      ]),
      node("thoi-su", "Thời sự", "thoi-su", [
        ["Chính trị", "thoi-su/chinh-tri"],
        ["Giao thông", "thoi-su/giao-thong"],
        ["Chống tham nhũng", "thoi-su/chong-tham-nhung"],
      ]),
      node("phap-luat", "Pháp luật", "phap-luat", [
        ["Hồ sơ vụ án", "phap-luat/ho-so-vu-an"],
        ["Tư vấn pháp luật", "phap-luat/tu-van-phap-luat"],
      ]),
      node("the-gioi", "Thế giới", "the-gioi", [
        ["Tư liệu", "the-gioi/tu-lieu"],
        ["Quân sự", "the-gioi/quan-su"],
      ]),
      node("kinh-doanh", "Kinh doanh", "kinh-doanh", [
        ["Chứng khoán", "kinh-doanh/chung-khoan"],
        ["Tài chính - Ngân hàng", "kinh-doanh/tai-chinh-ngan-hang"],
      ]),
      node("bat-dong-san", "Bất động sản", "bat-dong-san", null),
      node("the-thao", "Thể thao", "the-thao", [
        ["Bóng đá", "the-thao/bong-da"],
        ["Quần vợt", "the-thao/quan-vot"],
      ]),
      node("giao-duc", "Giáo dục", "giao-duc", [
        ["Tuyển sinh", "giao-duc/tuyen-sinh"],
        ["Du học", "giao-duc/du-hoc"],
      ]),
      node("giai-tri", "Giải trí", "giai-tri", [
        ["Sao Việt", "giai-tri/sao-viet"],
        ["Phim", "giai-tri/phim"],
      ]),
      node("suc-khoe", "Sức khỏe", "suc-khoe", null),
      node("cong-nghe", "Công nghệ", "cong-nghe", null),
      node("du-lich", "Du lịch", "du-lich", null),
    ];
  }

  /* ------------------------------------------------------------------ *
   * 3. SINH 10 BÀI VIẾT GIẢ LẬP CHO MỖI CHUYÊN MỤC LỚN
   * ------------------------------------------------------------------ */

  const AUTHORS = [
    "Minh Anh", "Hoàng Nam", "Thu Hà", "Quốc Bảo", "Lan Phương",
    "Đức Thịnh", "Ngọc Mai", "Văn Toàn", "Khánh Linh", "Hải Đăng",
  ];

  /** Bộ mẫu tiêu đề theo chuyên mục (mỗi chuyên mục >= 10 mẫu để không trùng) */
  const TITLE_TEMPLATES = [
    "{c}: Những điều cần biết về diễn biến mới nhất trong tuần",
    "Toàn cảnh {c} - điểm nhấn nổi bật khiến dư luận quan tâm",
    "Chuyên gia nói gì về xu hướng mới của lĩnh vực {c}?",
    "Cập nhật nóng: {c} ghi nhận thay đổi đáng chú ý",
    "Phía sau câu chuyện {c} gây chú ý trong những ngày qua",
    "{c} năm 2026: Cơ hội và thách thức đặt ra cho người dân",
    "Nhìn lại một năm biến động của {c} qua những con số",
    "Người trẻ nghĩ gì về vấn đề đang nóng của {c}?",
    "Giải pháp nào cho bài toán khó trong lĩnh vực {c}?",
    "Hỏi - đáp nhanh: Quy định mới liên quan đến {c} từ tháng này",
  ];

  const PARAGRAPH_POOL = [
    "Theo ghi nhận của phóng viên, vấn đề này đang nhận được sự quan tâm lớn từ đông đảo bạn đọc và các cơ quan chức năng.",
    "Đại diện đơn vị liên quan cho biết sẽ tiếp tục theo dõi sát sao và có những điều chỉnh phù hợp trong thời gian tới.",
    "Các chuyên gia nhận định, để giải quyết căn cơ cần có sự phối hợp đồng bộ giữa nhiều bên và lộ trình thực hiện rõ ràng.",
    "Nhiều người dân bày tỏ mong muốn thông tin được công khai, minh bạch để cùng giám sát và đóng góp ý kiến.",
    "Số liệu thống kê cho thấy xu hướng này đã tăng đều trong những quý gần đây, tạo ra không ít áp lực cho cơ quan quản lý.",
    "Bên cạnh những mặt tích cực, vẫn còn không ít khó khăn, vướng mắc cần được tháo gỡ kịp thời để đảm bảo hiệu quả.",
    "Phóng viên Dân trí sẽ tiếp tục cập nhật diễn biến của sự việc trong những bài viết tiếp theo.",
  ];

  function buildMockPosts(menu) {
    const posts = [];
    // mốc thời gian cơ sở: cố định để dữ liệu ổn định giữa các lần chạy
    const base = new Date(2026, 8, 28, 12, 22, 46, 655); // 28/09/2026 12:22:46.655

    let counter = 0;
    menu
      .filter((m) => m.type !== "home")
      .forEach((cat) => {
        for (let i = 0; i < 10; i++) {
          counter++;
          const d = new Date(base.getTime() - counter * 37 * 60 * 1000); // lùi 37 phút/bài
          const child =
            cat.children && cat.children.length
              ? cat.children[i % cat.children.length]
              : null;

          const title = TITLE_TEMPLATES[i].replace("{c}", cat.title);
          const slug = slugify(title);
          const id = `dtri-${compactTimestamp(d)}`;
          const excerpt =
            `${title.replace(/:.*$/, "")} - bài viết tổng hợp thông tin, ` +
            `ý kiến chuyên gia và phản hồi từ người dân về chuyên mục ${cat.title}.`;

          // nội dung ~5 đoạn, phân tách bằng \n
          const paragraphs = [];
          for (let p = 0; p < 5; p++) {
            paragraphs.push(PARAGRAPH_POOL[(i + p) % PARAGRAPH_POOL.length]);
          }

          posts.push({
            id: id,
            title: title,
            slug: slug,
            excerpt: excerpt,
            content: paragraphs.join("\n"),
            author: AUTHORS[(counter - 1) % AUTHORS.length],
            category: child ? [cat.title, child.title] : [cat.title],
            publishedAt: formatDateTime(d),
            source: DEFAULT_SOURCE,
            url: `${BASE_URL}/${slugify(cat.title)}/${slug}-${compactTimestamp(d)}.htm`,
          });
        }
      });
    return posts;
  }

  /* ------------------------------------------------------------------ *
   * 4. KHỞI TẠO & CRUD LOCALSTORAGE
   * ------------------------------------------------------------------ */

  /** Khởi tạo dữ liệu mẫu nếu LocalStorage chưa có */
  function init() {
    try {
      let menu = safeParse(localStorage.getItem(STORAGE_KEYS.MENU), null);
      if (!Array.isArray(menu) || menu.length === 0) {
        menu = buildDefaultMenu();
        localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menu));
      }

      let posts = safeParse(localStorage.getItem(STORAGE_KEYS.POSTS), null);
      if (!Array.isArray(posts)) {
        posts = buildMockPosts(menu);
        localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
      }
      localStorage.setItem(STORAGE_KEYS.INIT_FLAG, "1");
    } catch (e) {
      console.error("[DataStore] Không thể khởi tạo LocalStorage:", e);
    }
  }

  function getMenu() {
    return safeParse(localStorage.getItem(STORAGE_KEYS.MENU), []);
  }

  function getPosts() {
    return safeParse(localStorage.getItem(STORAGE_KEYS.POSTS), []);
  }

  function getPostById(id) {
    return getPosts().find((p) => p.id === id) || null;
  }

  function getPostBySlug(slug) {
    return getPosts().find((p) => p.slug === slug) || null;
  }

  /** Lấy bài theo tên chuyên mục (khớp bất kỳ phần tử trong mảng category) */
  function getPostsByCategory(name) {
    return getPosts().filter((p) => Array.isArray(p.category) && p.category.includes(name));
  }

  /**
   * Lưu 1 bài viết. Kiểm tra trùng id: nếu trùng thì KHÔNG ghi đè.
   * @returns {{ok:boolean, duplicated:boolean, message:string}}
   */
  function savePost(post) {
    const posts = getPosts();
    if (posts.some((p) => p.id === post.id)) {
      return { ok: false, duplicated: true, message: `Bài viết id "${post.id}" đã tồn tại, không ghi đè.` };
    }
    posts.unshift(post); // bài mới lên đầu
    try {
      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
    } catch (e) {
      return { ok: false, duplicated: false, message: "Lỗi ghi LocalStorage (có thể đã đầy): " + e.message };
    }
    return { ok: true, duplicated: false, message: "Đã lưu bài viết vào LocalStorage." };
  }

  /** Xóa toàn bộ dữ liệu và khởi tạo lại dữ liệu mẫu (tiện khi test) */
  function reset() {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    init();
  }

  // Tự khởi tạo khi nạp file
  init();

  global.DataStore = {
    KEYS: STORAGE_KEYS,
    DEFAULT_SOURCE: DEFAULT_SOURCE,
    slugify: slugify,
    formatDateTime: formatDateTime,
    init: init,
    reset: reset,
    getMenu: getMenu,
    getPosts: getPosts,
    getPostById: getPostById,
    getPostBySlug: getPostBySlug,
    getPostsByCategory: getPostsByCategory,
    savePost: savePost,
  };
})(window);
