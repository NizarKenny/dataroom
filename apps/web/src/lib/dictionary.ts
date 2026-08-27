import type { Phrase } from './i18n'

/**
 * Every word the interface says, in both languages, grouped by where it is said.
 *
 * Phrases that carry a number or a name are functions, because word order and
 * case endings are not the same in the two languages and a template with holes
 * in it only works for one of them.
 */

const p = (en: string, ua: string): Phrase => ({ en, ua })

export const d = {
  common: {
    cancel: p('Cancel', 'Скасувати'),
    create: p('Create', 'Створити'),
    delete: p('Delete', 'Видалити'),
    rename: p('Rename', 'Перейменувати'),
    share: p('Share', 'Поділитися'),
    download: p('Download', 'Завантажити'),
    name: p('Name', 'Назва'),
    size: p('Size', 'Розмір'),
    files: p('Files', 'Файли'),
    folders: p('Folders', 'Папки'),
    wentWrong: p('Something went wrong', 'Щось пішло не так'),
    didNotWork: p('That did not work', 'Не вийшло'),
    close: p('Close', 'Закрити'),
    account: p('Account', 'Обліковий запис'),
    signOut: p('Sign out', 'Вийти'),
    oneMoment: p('One moment', 'Хвилинку'),
    reload: p('Reload', 'Перезавантажити'),
    couldNotDraw: p(
      'The page could not be drawn. Reloading usually clears it.',
      'Сторінку не вдалося намалювати. Перезавантаження зазвичай допомагає.',
    ),
  },

  theme: {
    toDark: p('Switch to the dark theme', 'Перемкнути на темну тему'),
    toLight: p('Switch to the light theme', 'Перемкнути на світлу тему'),
  },

  language: {
    label: p('Language', 'Мова'),
    english: p('English', 'English'),
    ukrainian: p('Ukrainian', 'Українська'),
  },

  columns: {
    access: p('Access', 'Доступ'),
    modified: p('Modified', 'Змінено'),
    arrange: p('Choose and arrange the columns', 'Вибрати й розставити колонки'),
    reset: p('Reset to the default', 'Повернути як було'),
    moveLeft: (label: string) => p(`Move ${label} left`, `Пересунути «${label}» ліворуч`),
    moveRight: (label: string) => p(`Move ${label} right`, `Пересунути «${label}» праворуч`),
    private: p('Private', 'Лише власник'),
    inherited: p('Inherited', 'Успадковано'),
    actionsFor: (name: string) => p(`Actions for ${name}`, `Дії з «${name}»`),
    moveTo: p('Move to', 'Перемістити'),
    history: p('History', 'Історія'),
  },

  pager: {
    label: p('Pages', 'Сторінки'),
    earlier: p('Earlier pages', 'Попередні сторінки'),
    later: p('Later pages', 'Наступні сторінки'),
    page: (n: number) => p(`Page ${n}`, `Сторінка ${n}`),
  },

  modified: {
    label: p('Modified', 'Змінено'),
    any: p('Any time', 'Будь-коли'),
    today: p('Last 24 hours', 'За 24 години'),
    week: p('Last 7 days', 'За 7 днів'),
    month: p('Last 30 days', 'За 30 днів'),
    year: p('Last 12 months', 'За 12 місяців'),
  },

  rooms: {
    title: p('Data rooms', 'Кімнати даних'),
    lede: p(
      'Rooms you own, and rooms shared with you.',
      'Ваші кімнати та ті, до яких вам дали доступ.',
    ),
    newRoom: p('New data room', 'Нова кімната'),
    empty: p('Nothing here yet', 'Тут поки порожньо'),
    emptyLede: p(
      'A data room is the top folder of a deal. Everything else goes inside it.',
      'Кімната даних, це верхня папка угоди. Усе інше лежить у ній.',
    ),
    createFirst: p('Create the first one', 'Створити першу'),
    sharedWithYou: p('Shared with you', 'Вам відкрито доступ'),
    newTitle: p('New data room', 'Нова кімната даних'),
    newLede: p(
      'Name it after the deal. You can rename it later.',
      'Назвіть за угодою. Потім можна перейменувати.',
    ),
    deleteLede: p(
      'The whole room goes, with every document in it and every link into it. This cannot be undone.',
      'Кімната зникне разом з усіма документами й усіма посиланнями на неї. Це не скасувати.',
    ),
    deleteConfirm: p('Delete the data room', 'Видалити кімнату'),
    fileCount: (n: number) =>
      p(n === 1 ? '1 file' : `${n} files`, `${n} ${plural(n, 'файл', 'файли', 'файлів')}`),
  },

  browser: {
    newFolder: p('New folder', 'Нова папка'),
    upload: p('Upload', 'Завантажити'),
    uploadFiles: p('Upload files', 'Завантажити файли'),
    search: p('Search this data room', 'Пошук у цій кімнаті'),
    searchShared: p('Search what was shared', 'Пошук у відкритому'),
    clearSearch: p('Clear the search', 'Очистити пошук'),
    emptyOwner: p('Nothing in here yet', 'Тут поки порожньо'),
    emptyOwnerLede: p(
      'Drop files anywhere on this page, or make a folder to sort them into.',
      'Перетягніть файли будь-куди на цю сторінку або створіть папку, щоб їх розкласти.',
    ),
    emptyReader: p('This folder is empty', 'Ця папка порожня'),
    emptyReaderLede: p('Nothing has been put in here yet.', 'Сюди ще нічого не поклали.'),
    filteredEmpty: p('Nothing changed that recently', 'За цей час нічого не змінювалося'),
    filteredEmptyLede: p(
      'This folder has more in it, outside the window you picked.',
      'У папці є ще документи, але поза вибраним проміжком.',
    ),
    showEverything: p('Show everything', 'Показати все'),
    notHere: p('This folder is not here', 'Такої папки немає'),
    notHereLede: p(
      'It may have been deleted, or your access to it may have been turned off.',
      'Її могли видалити, або ваш доступ до неї вимкнули.',
    ),
    loadFailed: p(
      'The folder could not be loaded. Try again in a moment.',
      'Не вдалося завантажити папку. Спробуйте за хвилину.',
    ),
    backToRooms: p('Back to the data rooms', 'До списку кімнат'),
    theDataRooms: p('the data rooms', 'списку кімнат'),
    backTo: (to: string) => p(`Back to ${to}`, `Назад до «${to}»`),
    breadcrumb: p('Breadcrumb', 'Шлях'),
    moved: p('Moved', 'Переміщено'),
    deleteFailed: p('That could not be deleted', 'Не вдалося видалити'),
    renameTitle: (name: string) => p(`Rename ${name}`, `Перейменувати «${name}»`),
    newFolderTitle: p('New folder', 'Нова папка'),
  },

  search: {
    nothing: (query: string) =>
      p(`Nothing matches “${query}”`, `Нічого не знайшлося за «${query}»`),
    nothingLede: p(
      'This looks at file names across everything you can see in this data room.',
      'Пошук іде за назвами файлів по всьому, що вам видно в цій кімнаті.',
    ),
    goToFolder: p('Go to folder', 'До папки'),
    truncated: (n: number) =>
      p(
        `The first ${n} matches. Type more of the name to narrow it.`,
        `Перші ${n} збігів. Допишіть назву, щоб звузити.`,
      ),
  },

  share: {
    title: (name: string) => p(`Share ${name}`, `Доступ до «${name}»`),
    lede: p(
      'Anyone given access here can also see everything inside it.',
      'Кожен, кому тут відкрито доступ, побачить і все, що всередині.',
    ),
    people: p('People', 'Люди'),
    link: p('Link', 'Посилання'),
    linkOn: p('Link · on', 'Посилання · увімкнено'),
    invite: p('Invite', 'Запросити'),
    emailPlaceholder: p('name@company.com', 'name@company.com'),
    nobodyYet: p('Nobody has been invited yet.', 'Ще нікого не запросили.'),
    nobodyButLink: p(
      'Nobody has been invited by name. A link to this is switched on.',
      'Поіменно нікого не запрошено. Але посилання на це увімкнене.',
    ),
    linkLede: p(
      'A link lets someone read this without an account. You can turn it off again at any time.',
      'За посиланням можна читати без облікового запису. Вимкнути можна будь-коли.',
    ),
    createLink: p('Create a link', 'Створити посилання'),
    copy: p('Copy', 'Копіювати'),
    copied: p('Link copied', 'Посилання скопійовано'),
    linkOnLede: p(
      'Anyone with this link can read this and everything inside it, without an account. Turning it off breaks every copy of it that has been sent.',
      'Кожен, у кого є це посилання, прочитає це і все всередині, без облікового запису. Вимкнення обірве всі надіслані копії.',
    ),
    turnOff: p('Turn the link off', 'Вимкнути посилання'),
    turnOffTitle: p('Turn this link off?', 'Вимкнути це посилання?'),
    turnOffLede: p(
      'Every copy of it stops working, wherever it has been sent. Anyone who needs access after that has to be given a new link or invited by name.',
      'Усі його копії перестануть працювати, куди б їх не надіслали. Кому потрібен доступ далі, доведеться дати нове посилання або запросити поіменно.',
    ),
    turnItOff: p('Turn it off', 'Вимкнути'),
    remove: (email: string) => p(`Remove ${email}`, `Прибрати ${email}`),
    inherited: p('Inherited', 'Успадковано'),
    unknown: p('Unknown', 'Невідомо'),
    givenAbove: p('Given access on a folder above this one', 'Доступ дано на папці вище цієї'),
  },

  access: {
    manage: p('Manage', 'Керувати'),
    peopleCount: (n: number) =>
      p(n === 1 ? '1 person' : `${n} people`, `${n} ${plural(n, 'людина', 'людини', 'людей')}`),
    anyoneWithLink: p('anyone with the link', 'кожен, хто має посилання'),
    and: p(' and ', ' і '),
    sharedWith: (who: string) =>
      p(`This folder is shared with ${who}.`, `Ця папка відкрита для: ${who}.`),
    visibleToAt: (who: string, where: string) =>
      p(
        `Everything here is visible to ${who}, granted on ${where}.`,
        `Усе тут видно для: ${who}. Доступ дано на «${where}».`,
      ),
    visibleToAbove: (who: string) =>
      p(
        `Everything here is visible to ${who}, granted on a folder above.`,
        `Усе тут видно для: ${who}. Доступ дано на папці вище.`,
      ),
    seeWho: p('See who', 'Подивитися хто'),
    sharedWithLink: p(
      'This folder is shared with anyone with the link.',
      'Ця папка відкрита кожному, хто має посилання.',
    ),
    readerFolder: (name: string) =>
      p(
        `You can see ${name} and everything inside it.`,
        `Вам видно «${name}» і все, що всередині.`,
      ),
    readerRestInvite: p(
      'The rest of the data room is not shared with you.',
      'Решта кімнати вам не відкрита.',
    ),
    readerRestLink: p(
      'Anyone holding this link sees the same.',
      'Кожен, хто має це посилання, бачить те саме.',
    ),
  },

  upload: {
    keepBoth: p('Keep both', 'Лишити обидва'),
    newVersion: p('New version', 'Нова версія'),
    skip: p('Skip', 'Пропустити'),
    done: p('Done', 'Готово'),
    retry: p('Retry', 'Ще раз'),
    uploading: (done: number, total: number) =>
      p(`Uploading ${done} of ${total}`, `Завантаження ${done} з ${total}`),
    uploaded: (n: number) =>
      p(
        n === 1 ? '1 file uploaded' : `${n} files uploaded`,
        `${n} ${plural(n, 'файл', 'файли', 'файлів')} завантажено`,
      ),
    needsDecision: (n: number) =>
      p(
        n === 1 ? '1 file needs a decision' : `${n} files need a decision`,
        `${n} ${plural(n, 'файл потребує', 'файли потребують', 'файлів потребують')} рішення`,
      ),
    alreadyHere: (name: string) =>
      p(`${name} is already in this folder`, `«${name}» вже є в цій папці`),
    failed: p('The upload did not go through', 'Завантаження не пройшло'),
    failedCount: (n: number) =>
      p(
        n === 1 ? '1 file did not go through' : `${n} files did not go through`,
        `${n} ${plural(n, 'файл не пройшов', 'файли не пройшли', 'файлів не пройшло')}`,
      ),
  },

  versions: {
    title: (name: string) => p(`History of ${name}`, `Історія «${name}»`),
    lede: p(
      'Uploading over a name keeps what was there. Nothing here is deleted until the file is.',
      'Завантаження поверх назви зберігає те, що було. Тут нічого не зникає, доки не зникне сам файл.',
    ),
    version: (n: number) => p(`Version ${n}`, `Версія ${n}`),
    current: p('Current', 'Поточна'),
    makeCurrent: p('Make current', 'Зробити поточною'),
    open: (n: number) => p(`Open version ${n}`, `Відкрити версію ${n}`),
    restored: (n: number) => p(`Version ${n} is current again`, `Версія ${n} знову поточна`),
  },

  del: {
    fileLede: p(
      'The file and any link to it stop working. This cannot be undone.',
      'Файл і будь-яке посилання на нього перестануть працювати. Це не скасувати.',
    ),
    folderLede: p(
      'Everything inside goes with it, and any link into it stops working. This cannot be undone.',
      'Усе, що всередині, зникне разом з нею, а посилання всередину перестануть працювати. Це не скасувати.',
    ),
    title: (name: string) => p(`Delete ${name}?`, `Видалити «${name}»?`),
    sharesThatStop: p('Shares that stop working', 'Доступи, що обірвуться'),
    deleteItems: (n: number) =>
      p(`Delete ${n} items`, `Видалити ${n} ${plural(n, 'об’єкт', 'об’єкти', 'об’єктів')}`),
  },

  move: {
    title: (name: string) => p(`Move ${name}`, `Перемістити «${name}»`),
    lede: p('Pick where it should go.', 'Виберіть, куди його покласти.'),
    hereNow: p('Here now', 'Зараз тут'),
    move: p('Move', 'Перемістити'),
  },

  link: {
    revoked: p('This link no longer works', 'Це посилання більше не працює'),
    revokedLede: p(
      'Whoever shared it has turned it off. Ask them for a new one.',
      'Той, хто ним поділився, вимкнув його. Попросіть нове.',
    ),
    invalid: p('This link is not valid', 'Посилання неправильне'),
    invalidLede: p(
      'Check that you copied the whole address.',
      'Перевірте, чи скопіювали адресу повністю.',
    ),
    failed: p('This link could not be opened', 'Не вдалося відкрити посилання'),
    failedLede: p(
      'Something went wrong on our side. Try again in a moment.',
      'Щось зламалося на нашому боці. Спробуйте за хвилину.',
    ),
    folderFailed: p(
      'This folder could not be loaded. The link may have been switched off while you were reading.',
      'Не вдалося завантажити папку. Можливо, посилання вимкнули, доки ви читали.',
    ),
  },

  signIn: {
    signIn: p('Sign in', 'Увійти'),
    createAccount: p('Create account', 'Створити запис'),
    signInLede: p(
      'Sign in to reach the rooms shared with you.',
      'Увійдіть, щоб потрапити до відкритих вам кімнат.',
    ),
    createLede: p(
      'Create an account to open your first data room.',
      'Створіть запис, щоб відкрити свою першу кімнату даних.',
    ),
    email: p('Email', 'Пошта'),
    password: p('Password', 'Пароль'),
    passwordHint: p('At least 8 characters.', 'Щонайменше 8 символів.'),
    noAccount: p('No account yet?', 'Ще немає запису?'),
    haveAccount: p('Already have an account?', 'Уже маєте запис?'),
    createOne: p('Create one', 'Створити'),
  },

  errors: {
    unauthorized: p('Sign in to continue', 'Увійдіть, щоб продовжити'),
    read_only: p(
      'You can view this data room, but not change it',
      'Цю кімнату можна дивитися, але не змінювати',
    ),
    share_revoked: p('This link no longer works', 'Це посилання більше не працює'),
    not_found: p(
      'That does not exist, or you do not have access to it',
      'Такого немає, або у вас немає доступу',
    ),
  },
} as const

/**
 * Ukrainian counts in three: one file, two files, five files. English does not,
 * which is why every counted phrase here is a function rather than a template.
 */
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = n % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
