import {describe, expect, it} from 'vitest'

import {applyTemplate, fillPlaceholders, hashtagLine, templateContext} from './templates'

describe('fillPlaceholders', () => {
  it('fills what it knows', () => {
    expect(fillPlaceholders('Out now: {{title}}', {title: 'Nachtfahrt'})).toBe('Out now: Nachtfahrt')
  })

  it('ignores spacing and case in the placeholder', () => {
    expect(fillPlaceholders('{{ Title }}', {title: 'X'})).toBe('X')
  })

  it('leaves unknown placeholders standing', () => {
    expect(fillPlaceholders('{{title}} by {{artist}}', {title: 'X'})).toBe('X by {{artist}}')
    expect(fillPlaceholders('{{title}}', {title: ''})).toBe('{{title}}')
  })

  it('handles missing text', () => {
    expect(fillPlaceholders(undefined)).toBe('')
  })
})

describe('hashtagLine', () => {
  it('normalises tags however they were typed', () => {
    expect(hashtagLine(['metal', '#newrelease', '  live music '])).toBe(
      '#metal #newrelease #livemusic',
    )
  })

  it('drops duplicates regardless of case', () => {
    expect(hashtagLine(['Metal', 'metal', '##metal'])).toBe('#Metal')
  })

  it('fills placeholders in tags', () => {
    expect(hashtagLine(['{{artist}}', 'tour'], {artist: 'Nachtfahrt'})).toBe('#Nachtfahrt #tour')
  })

  it('survives nothing', () => {
    expect(hashtagLine(undefined)).toBe('')
    expect(hashtagLine(['', '#', '   '])).toBe('')
  })
})

describe('applyTemplate', () => {
  const template = {
    title: 'Album release',
    caption: 'Out now: {{title}}',
    firstComment: 'All links in the bio',
    hashtags: ['metal', 'newrelease'],
  }

  it('replaces the caption and appends the hashtags', () => {
    const patch = applyTemplate({title: 'Nachtfahrt', content: 'old'}, template, [
      'caption',
      'hashtags',
    ], {title: 'Nachtfahrt'})

    expect(patch.content).toBe('Out now: Nachtfahrt\n\n#metal #newrelease')
    expect(patch.firstComment).toBeUndefined()
  })

  it('appends hashtags under text that is already there', () => {
    const patch = applyTemplate({content: 'Written by hand'}, template, ['hashtags'])
    expect(patch.content).toBe('Written by hand\n\n#metal #newrelease')
  })

  it('puts the hashtags in the first comment when the template says so', () => {
    const patch = applyTemplate({content: 'Caption'}, {...template, hashtagPlacement: 'firstComment'}, [
      'firstComment',
      'hashtags',
    ])

    expect(patch.content).toBeUndefined()
    expect(patch.firstComment).toBe('All links in the bio\n\n#metal #newrelease')
  })

  it('does nothing without a template or without parts', () => {
    expect(applyTemplate({}, undefined, ['caption'])).toEqual({})
    expect(applyTemplate({}, template, [])).toEqual({})
  })
})

describe('templateContext', () => {
  it('offers title, kind and the scheduled time', () => {
    const context = templateContext({
      title: 'Album',
      kind: 'feed',
      scheduledFor: new Date(2027, 2, 5, 10, 30).toISOString(),
      targets: [{label: 'Main account'}],
    })

    expect(context.title).toBe('Album')
    expect(context.kind).toBe('feed')
    expect(context.time).toBe('10:30')
    expect(context.accounts).toBe('Main account')
  })

  it('leaves the time out when there is none', () => {
    expect(templateContext({title: 'x'}).time).toBeUndefined()
  })
})
