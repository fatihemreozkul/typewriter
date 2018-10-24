import {
  quicktypeMultiFile,
  InputData,
  JSONSchemaInput,
  JavaRenderer,
  JavaTargetLanguage,
  RenderContext,
  ClassType,
  Name,
  TargetLanguage,
  Sourcelike,
  ArrayType,
  Type
} from 'quicktype-core'

import { modifySource, SerializedRenderResult } from 'quicktype-core/dist/Source'
import { OptionValues, BooleanOption, StringOption } from 'quicktype-core/dist/RendererOptions'
import { javaNameStyle } from 'quicktype-core/dist/language/Java'

import {
  getTypedTrackHandler,
  TrackedEvent,
  builder as defaultBuilder,
  Params as DefaultParams
} from '../lib'
import * as fs from 'fs'
import * as util from 'util'
import { map, camelCase, upperFirst } from 'lodash'

const writeFile = util.promisify(fs.writeFile)

export const command = 'gen-android'
export const desc = 'Generate a strongly typed analytics-android client'
export const builder = {
  ...defaultBuilder,
  package: {
    type: 'string',
    required: true,
    description: 'Package name to use for generated classes'
  },
  trackingPlan: {
    type: 'string',
    required: false,
    description: 'Tracking Plan name to use for generated Analytics class'
  },
  language: {
    type: 'string',
    required: false,
    default: 'java',
    choices: ['java'],
    description: 'Which Android language bindings to output'
  }
}
export type Params = DefaultParams & {
  package: string
  trackingPlan: string
  language: string
}

declare const analyticsJavaOptions: {
  justTypes: BooleanOption
  packageName: StringOption
  trackingPlan: StringOption
}

function toKeyName(name: string) {
  return javaNameStyle(true, true, `${name}_KEY`)
}
class AnalyticsJavaTargetLanguage extends JavaTargetLanguage {
  public packageName: string
  public trackingPlan: string

  constructor(packageName: string, trackingPlan: string) {
    super()
    this.packageName = packageName
    this.trackingPlan = trackingPlan
  }

  protected makeRenderer(renderContext: RenderContext, _: { [name: string]: any }): JavaRenderer {
    return new AnalyticsJavaWrapperRenderer(this, renderContext, {
      justTypes: true,
      packageName: this.packageName,
      trackingPlan: this.trackingPlan
    })
  }
  protected get defaultIndentation(): string {
    return '    '
  }

  get supportsOptionalClassProperties(): boolean {
    return true
  }
}

class AnalyticsJavaWrapperRenderer extends JavaRenderer {
  constructor(
    targetLanguage: TargetLanguage,
    renderContext: RenderContext,
    protected readonly options: OptionValues<typeof analyticsJavaOptions>
  ) {
    super(targetLanguage, renderContext, options)
  }

  protected emitAutogeneratedFileWarning() {
    this.emitCommentLines(['This code is auto-generated by Segment Typewriter. Do not edit.'])
  }

  protected emitFileHeader(importGroups: string[][]): void {
    this.emitAutogeneratedFileWarning()
    this.emitLine('package ', this.options.packageName, ';')
    this.ensureBlankLine()

    for (const imports of importGroups) {
      for (const pkg of imports) {
        this.emitLine('import ', pkg, ';')
      }
      this.ensureBlankLine()
    }
  }

  protected emitBuilderKeys(c: ClassType): void {
    this.forEachClassProperty(c, 'none', (_, jsonName) => {
      this.emitLine('private static String ', toKeyName(jsonName), ' = "', jsonName, '";')
    })
  }

  protected javaType(reference: boolean, t: Type, withIssues: boolean = false): Sourcelike {
    if (t instanceof ArrayType) {
      return ['List<', this.javaType(false, t.items, withIssues), '>']
    }
    return super.javaType(reference, t, withIssues)
  }

  protected emitBuilderSetters(c: ClassType, className: Name): void {
    this.forEachClassProperty(c, 'leading-and-interposing', (name, jsonName, p) => {
      this.emitDescriptionBlock([
        ...(this.descriptionForClassProperty(c, jsonName) || []),
        p.isOptional
          ? [
              'This property is optional and not required to generate a valid ',
              className,
              ' object'
            ]
          : ['This property is required to generate a valid ', className, ' object']
      ])
      const type = this.javaType(true, p.type)
      this.emitBlock(['public Builder ', name, '(final @NonNull ', type, ' ', name, ')'], () => {
        // TODO: Is there a better way to check if this type is an array? It's really a UnionType<ArrayType, ClassType>
        const value =
          type instanceof Array && type[0] === 'List<'
            ? ['PropertiesSerializable.toPropertyList(', name, ')']
            : [name]
        this.emitLine(['properties.putValue(', toKeyName(jsonName), ', ', ...value, ');'])
        this.emitLine('return this;')
      })
    })
  }

  protected emitRuntimeValidation(c: ClassType, className: Name): void {
    this.forEachClassProperty(c, 'none', (name, jsonName, p) => {
      if (!p.isOptional) {
        this.emitBlock(['if (properties.get(', toKeyName(jsonName), ') == null)'], () => {
          this.emitLine([
            'throw new IllegalArgumentException("',
            className,
            ' missing required property: ',
            name,
            '");'
          ])
        })
        this.ensureBlankLine()
      }
    })
  }

  protected emitClassBuilderDefinition(c: ClassType, className: Name): void {
    this.emitDescriptionBlock([['Builder for {@link ', className, '}']])
    this.emitBlock(['public static class Builder'], () => {
      this.emitBuilderKeys(c)
      this.ensureBlankLine()

      this.emitLine('private Properties properties;')
      this.ensureBlankLine()

      this.emitDescriptionBlock([['Builder for {@link ', className, '}']])
      this.emitBlock('public Builder()', () => {
        this.emitLine('properties = new Properties();')
      })
      this.ensureBlankLine()

      this.emitBuilderSetters(c, className)
      this.ensureBlankLine()

      const requiredProperties: Sourcelike[] = []
      this.forEachClassProperty(c, 'none', (name, __, p) => {
        if (!p.isOptional) {
          requiredProperties.push([' - ', name])
        }
      })
      if (requiredProperties.length > 0) {
        requiredProperties.unshift(
          'Performs runtime validation on the following required properties:'
        )
      }
      this.emitDescriptionBlock([
        ['Build an instance of {@link ', className, '}'],
        ...requiredProperties
      ])
      this.emitBlock(['public ', className, ' build()'], () => {
        this.emitRuntimeValidation(c, className)
        this.emitLine(['return new ', className, '(properties);'])
      })
    })
  }

  protected emitPropertiesSerializableImplementation(className: Name): void {
    this.emitLine('private Properties properties;')
    this.ensureBlankLine()
    this.emitBlock(['private ', className, '(Properties properties)'], () => {
      this.emitLine('this.properties = properties;')
    })
    this.ensureBlankLine()
    this.emitBlock(['protected Properties toProperties()'], () => {
      this.emitLine('return properties;')
    })
  }

  protected emitClassDefinition(c: ClassType, className: Name): void {
    this.startFile(className)
    const importGroups: string[][] = [
      ['android.support.annotation.NonNull'],
      ['java.util.ArrayList', 'java.util.List', 'java.util.Map', 'java.util.stream.Collectors']
    ]
    this.emitFileHeader(importGroups)
    // TODO: Emit class description, once we support top-level event descriptions in JSON Schema
    // this.emitDescription(this.descriptionForType(c));
    this.emitClassAttributes(c, className)
    this.emitBlock(['public final class ', className, ' extends PropertiesSerializable'], () => {
      this.emitPropertiesSerializableImplementation(className)
      this.ensureBlankLine()
      this.emitClassBuilderDefinition(c, className)
    })
    this.finishFile()
  }

  protected emitPropertiesSerializableInterface() {
    this.startFile('PropertiesSerializable')
    const importGroups: string[][] = [['java.util.ArrayList', 'java.util.List']]
    this.emitFileHeader(importGroups)
    this.emitBlock('abstract class PropertiesSerializable', () => {
      this.emitLine('abstract Properties toProperties();')
      this.ensureBlankLine()
      this.emitBlock(
        'static List<Properties> toPropertyList(List<? extends PropertiesSerializable> list)',
        () => {
          this.emitLine('List<Properties> properties = new ArrayList<>(list.size());')
          this.emitBlock('for (PropertiesSerializable item : list)', () => {
            this.emitLine('properties.add(item.toProperties());')
          })
          this.emitLine('return properties;')
        }
      )
    })
    this.finishFile()
  }

  protected emitAnalyticsEventWrapper(name: Name, withOptions: boolean): void {
    this.emitDescriptionBlock([
      // TODO: Emit a function description, once we support top-level event descriptions in JSON Schema
      ['@param props {@link ', name, '} to add extra information to this call.'],
      ['@see <a href="https://segment.com/docs/spec/track/">Track Documentation</a>']
    ])
    const camelCaseName = modifySource(camelCase, name)
    this.emitBlock(
      [
        'public void ',
        camelCaseName,
        '(final @Nullable ',
        name,
        ' props',
        withOptions ? ', final @Nullable Options options' : '',
        ')'
      ],
      () => {
        const rawEventName = name
          .proposeUnstyledNames(null)
          .values()
          .next().value
        this.emitLine([
          'this.analytics.track("',
          rawEventName,
          '", props.toProperties()',
          withOptions ? ', options' : '',
          ');'
        ])
      }
    )
  }

  protected emitAnalyticsWrapper(): void {
    const className = upperFirst(camelCase(`${this.options.trackingPlan || ''}Analytics`))
    this.startFile(className)
    this.emitFileHeader([
      [
        'com.segment.analytics.Analytics',
        'com.segment.analytics.Options',
        'android.content.Context',
        'android.support.annotation.NonNull',
        'android.support.annotation.Nullable'
      ]
    ])
    this.emitBlock(['public class ', className], () => {
      this.emitLine('private Analytics analytics;')
      this.ensureBlankLine()

      this.emitDescriptionBlock([
        [
          'Initializes a new ',
          className,
          ' client wrapping the provided Segment Analytics client.'
        ],
        '@param analytics {@link Analytics} configured Segment analytics instance',
        '@see <a href="https://segment.com/docs/sources/mobile/android/#getting-started">Android Getting Started</a>'
      ])
      this.emitBlock(['public ', className, '(final @NonNull Analytics analytics)'], () => {
        this.emitLine('this.analytics = analytics;')
      })
      this.ensureBlankLine()

      this.forEachTopLevel('leading-and-interposing', (_, name) => {
        this.emitAnalyticsEventWrapper(name, false)
        this.ensureBlankLine()
        this.emitAnalyticsEventWrapper(name, true)
      })
    })
  }

  protected emitSourceStructure(): void {
    super.emitSourceStructure()
    this.emitPropertiesSerializableInterface()
    this.emitAnalyticsWrapper()
  }
}

export async function genJava(
  events: TrackedEvent[],
  { package: packageName, trackingPlan }: Params
) {
  const inputData = new InputData()

  events.forEach(({ name, rules }) => {
    const schema = {
      $schema: 'http://json-schema.org/draft-04/schema#',
      title: rules.title,
      description: rules.description,
      ...rules.properties.properties
    }

    inputData.addSource(
      'schema',
      { name, uris: [name], schema: JSON.stringify(schema) },
      () => new JSONSchemaInput(undefined)
    )
  })

  const lang = new AnalyticsJavaTargetLanguage(packageName, trackingPlan)

  const files = await quicktypeMultiFile({ lang, inputData })
  return files
}

export const handler = getTypedTrackHandler(async (params: Params, { events }) => {
  let files: ReadonlyMap<string, SerializedRenderResult>

  if (params.language === 'java') {
    files = await genJava(events, params)
  }

  return Promise.all(
    map([...files.keys()], (fileName: string) => {
      return writeFile(`${params.outputPath}/${fileName}`, files.get(fileName).lines.join('\n'))
    })
  )
})
