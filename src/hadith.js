// Short, child-friendly hadith with a simple explanation and a quiz question.
// The "answer" is always options[0]; options are shuffled when shown.
export const HADITHS = [
  {
    text: 'Smiling at your brother is charity.',
    source: 'Tirmidhi',
    explain: 'A smile is a gift! When you smile at someone, it makes them happy — and Allah rewards you for it, just like giving charity.',
    question: "What did today's Hadith teach us?",
    options: ['A smile is a kind of charity', 'Only money counts as charity', 'We should never smile'],
  },
  {
    text: 'Allah is Kind and He loves kindness in all things.',
    source: 'Bukhari & Muslim',
    explain: 'Being gentle and kind to people, animals, and everything around us is something Allah loves.',
    question: 'What does Allah love, according to the Hadith?',
    options: ['Kindness in all things', 'Being rude when we are upset', 'Winning every game'],
  },
  {
    text: 'None of you truly believes until he loves for his brother what he loves for himself.',
    source: 'Bukhari & Muslim',
    explain: 'If you love getting a treat, wish the same good things for your friends and family too!',
    question: 'What should we wish for others?',
    options: ['The same good things we want for ourselves', 'Nothing at all', 'Only bad things'],
  },
  {
    text: 'Whoever believes in Allah and the Last Day, let him say something good or stay quiet.',
    source: 'Bukhari & Muslim',
    explain: 'Before we speak, we can ask: is this kind and good? If not, it is better to stay quiet.',
    question: 'If we cannot say something good, what should we do?',
    options: ['Stay quiet', 'Shout it loudly', 'Say something mean'],
  },
  {
    text: 'The strong person is not the one who wins a wrestling match. The strong person is the one who controls himself when angry.',
    source: 'Bukhari & Muslim',
    explain: 'Real strength is staying calm when you feel angry — take a deep breath instead of hurting anyone.',
    question: 'Who is truly strong?',
    options: ['The one who stays calm when angry', 'The one with the biggest muscles', 'The one who shouts the most'],
  },
  {
    text: 'Whoever does not thank people does not thank Allah.',
    source: 'Abu Dawud & Tirmidhi',
    explain: 'Saying "thank you" to your parents, teachers, and friends is part of being thankful to Allah.',
    question: 'What does this Hadith remind us to do?',
    options: ['Say thank you to people', 'Forget to say thank you', 'Only thank people who give us toys'],
  },
  {
    text: 'Cleanliness is half of faith.',
    source: 'Muslim',
    explain: 'Washing our hands, brushing our teeth, and keeping our room tidy are all part of being a good Muslim.',
    question: 'What is half of faith?',
    options: ['Cleanliness', 'Playing games', 'Eating sweets'],
  },
  {
    text: 'Give gifts to one another, and you will love one another.',
    source: 'Al-Adab Al-Mufrad',
    explain: 'Sharing a small gift — even a drawing or a snack — helps friends and family love each other more.',
    question: 'What happens when we give gifts to each other?',
    options: ['We love one another more', 'We become sad', 'Nothing happens'],
  },
  {
    text: 'The most beloved deeds to Allah are the ones done regularly, even if they are small.',
    source: 'Bukhari & Muslim',
    explain: 'Doing a small good deed every day — like saying Bismillah before eating — is very special to Allah.',
    question: 'Which deeds does Allah love the most?',
    options: ['Small good deeds done every day', 'Big deeds done only once', 'Deeds done to show off'],
  },
  {
    text: 'Make things easy and do not make them hard. Give good news and do not push people away.',
    source: 'Bukhari',
    explain: 'Help others, be cheerful, and make things simpler for people instead of harder.',
    question: 'What did the Prophet ﷺ tell us to do?',
    options: ['Make things easy for others', 'Make things hard for others', 'Push people away'],
  },
  {
    text: 'A good word is charity.',
    source: 'Bukhari & Muslim',
    explain: 'Saying something nice, like "Well done!" or "Can I help you?", is a charity too.',
    question: 'What is a good word?',
    options: ['A charity', 'A waste of time', 'Something to keep secret'],
  },
  {
    text: 'Removing something harmful from the road is charity.',
    source: 'Muslim',
    explain: 'Picking up a banana peel or a sharp stone so nobody gets hurt is a good deed!',
    question: 'What is charity, according to the Hadith?',
    options: ['Removing harmful things from the road', 'Throwing rubbish on the road', 'Running on the road'],
  },
  {
    text: 'Whoever is not merciful to others will not be shown mercy.',
    source: 'Bukhari & Muslim',
    explain: 'When we are gentle and caring with others, Allah is merciful to us.',
    question: 'How should we treat others?',
    options: ['With mercy and care', 'Roughly', 'By ignoring them'],
  },
  {
    text: 'The best of you are those who learn the Quran and teach it.',
    source: 'Bukhari',
    explain: 'Learning even a small Surah and teaching it to someone else makes you one of the best people!',
    question: 'Who are the best people, according to the Hadith?',
    options: ['Those who learn the Quran and teach it', 'Those who have the most toys', 'Those who run the fastest'],
  },
];

export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(local / 86400000);
}

export function hadithOfTheDay(date = new Date()) {
  const i = dayNumber(date) % HADITHS.length;
  return { index: i, ...HADITHS[i] };
}
