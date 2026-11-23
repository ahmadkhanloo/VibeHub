export const curriculumLevels = [
  { id: 'beginner', lessons: ['programming-basics', 'first-project', 'cli-basics', 'desktop-agent-basics'] },
  { id: 'intermediate', lessons: ['design-basics', 'testing-basics', 'clean-code', 'git-first-commit', 'git-agent-github', 'skill-basics'] },
  { id: 'advanced', lessons: ['claude-code-handbook', 'external-model-api', 'config-deploy', 'release-basics'] },
];

export const curriculum = curriculumLevels.flatMap(level => level.lessons);
