export type RankedMap = {
  id: string;
  title: string;
  artist: string;
  mapper: string;
  difficulty: string;
  stars: number;
  coverUrl: string;
  songHash?: string;
};

// 개발용 샘플 데이터입니다. 나중에 ScoreSaber/BeatSaver 전체 랭크맵 캐시로 교체하면 됩니다.
export const rankedMaps: RankedMap[] = [
  {
    id: 'nightmare-explus',
    title: 'Nightmare',
    artist: 'Sample Artist',
    mapper: 'Mapper A',
    difficulty: 'ExpertPlus',
    stars: 15.02,
    coverUrl: 'https://cdn.beatsaver.com/covers/68bda93b735c022279e84427d4fd26b82ee6a588.jpg'
  },
  {
    id: 'zero-break-explus',
    title: 'Zero-Break',
    artist: 'Sample Artist',
    mapper: 'Mapper B',
    difficulty: 'ExpertPlus',
    stars: 14.71,
    coverUrl: 'https://cdn.beatsaver.com/covers/9c9d5a8b0056b0f2ce2b5af187ce08296f0d1f16.jpg'
  },
  {
    id: 'gravity-explus',
    title: 'Gravity Collapse',
    artist: 'Sample Artist',
    mapper: 'Mapper C',
    difficulty: 'ExpertPlus',
    stars: 13.42,
    coverUrl: 'https://cdn.beatsaver.com/covers/451b8f503e168c5bbf5a9ce8c708c2605d8c7c92.jpg'
  },
  {
    id: 'sakura-expert',
    title: 'Sakura Stream',
    artist: 'Sample Artist',
    mapper: 'Mapper D',
    difficulty: 'Expert',
    stars: 12.36,
    coverUrl: 'https://cdn.beatsaver.com/covers/bd1b4a3efc685280e96f55dcff37efe686afbf7d.jpg'
  },
  {
    id: 'glass-explus',
    title: 'Glass Tech',
    artist: 'Sample Artist',
    mapper: 'Mapper E',
    difficulty: 'ExpertPlus',
    stars: 11.84,
    coverUrl: 'https://cdn.beatsaver.com/covers/8b42ff43c0cfa6ba1959b3c2ec0b5b6f7d55e902.jpg'
  },
  {
    id: 'light-expert',
    title: 'Light Trail',
    artist: 'Sample Artist',
    mapper: 'Mapper F',
    difficulty: 'Expert',
    stars: 10.15,
    coverUrl: 'https://cdn.beatsaver.com/covers/3a7d4e655542c7f240e91a69f19be94052cf18ec.jpg'
  },
  {
    id: 'blue-expert',
    title: 'Blue Archive',
    artist: 'Sample Artist',
    mapper: 'Mapper G',
    difficulty: 'Expert',
    stars: 9.58,
    coverUrl: 'https://cdn.beatsaver.com/covers/c4e2b6ff02f8eab4eae0a061694e7196b8a816a1.jpg'
  },
  {
    id: 'daily-hard',
    title: 'Daily Warmup',
    artist: 'Sample Artist',
    mapper: 'Mapper H',
    difficulty: 'Hard',
    stars: 8.07,
    coverUrl: 'https://cdn.beatsaver.com/covers/69309f54e45d5e8b2b210ddc287a65f5e2598bc0.jpg'
  },
  {
    id: 'orange-hard',
    title: 'Orange Step',
    artist: 'Sample Artist',
    mapper: 'Mapper I',
    difficulty: 'Hard',
    stars: 7.64,
    coverUrl: 'https://cdn.beatsaver.com/covers/9380177216b7d9c2415a634aa41adf93a1590fb7.jpg'
  },
  {
    id: 'green-normal',
    title: 'Green Daybreak',
    artist: 'Sample Artist',
    mapper: 'Mapper J',
    difficulty: 'Normal',
    stars: 6.25,
    coverUrl: 'https://cdn.beatsaver.com/covers/1b5ba2324d35510fe538c1df47bdc70f9e64db7f.jpg'
  },
  {
    id: 'easy-5',
    title: 'First Clear',
    artist: 'Sample Artist',
    mapper: 'Mapper K',
    difficulty: 'Normal',
    stars: 5.02,
    coverUrl: 'https://cdn.beatsaver.com/covers/bba4469f7bdfd01d46a5abcb60a6eec038ce8eaa.jpg'
  },
  {
    id: 'easy-4',
    title: 'Soft Beat',
    artist: 'Sample Artist',
    mapper: 'Mapper L',
    difficulty: 'Easy',
    stars: 4.71,
    coverUrl: 'https://cdn.beatsaver.com/covers/d2428e87f3f6e8f6fc5f10f571df329a1f4264cf.jpg'
  },
  {
    id: 'easy-3',
    title: 'Beginner Jump',
    artist: 'Sample Artist',
    mapper: 'Mapper M',
    difficulty: 'Easy',
    stars: 3.29,
    coverUrl: 'https://cdn.beatsaver.com/covers/010f3b4395500c38ecef433b90bf9327700fa764.jpg'
  },
  {
    id: 'easy-2',
    title: 'Slow Flow',
    artist: 'Sample Artist',
    mapper: 'Mapper N',
    difficulty: 'Easy',
    stars: 2.41,
    coverUrl: 'https://cdn.beatsaver.com/covers/7f1d13784704407fbdcf699cb91345451941b10a.jpg'
  },
  {
    id: 'easy-1',
    title: 'Tutorial Sky',
    artist: 'Sample Artist',
    mapper: 'Mapper O',
    difficulty: 'Easy',
    stars: 1.33,
    coverUrl: 'https://cdn.beatsaver.com/covers/37801fafb98f71ec74f517e3eb2d904940d38378.jpg'
  }
].sort((a, b) => b.stars - a.stars);
