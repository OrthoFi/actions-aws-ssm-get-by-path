import * as core from '@actions/core'
import {writeFileSync} from 'fs'
import {GetParametersByPathCommand, SSMClient} from '@aws-sdk/client-ssm'

async function run(): Promise<void> {
  try {
    const ssm = new SSMClient({})
    const paths = core.getInput('paths', {required: true}).split(',')
    const saveToEnvironment: Boolean = JSON.parse(
      core.getInput('save-to-environment', {required: true})
    )
    const prefix = core.getInput('prefix') || ''
    const delimiter = core.getInput('delimiter', {required: true})
    const params = {} as any

    for (const path of paths) {
      const result = await ssm.send(
        new GetParametersByPathCommand({
          Path: path,
          Recursive: JSON.parse(core.getInput('recursive', {required: true})),
          WithDecryption: JSON.parse(core.getInput('decrypt', {required: true}))
        })
      )

      if (saveToEnvironment) {
        core.startGroup(`Exporting from Path ${path}`)
      }

      for (const parameter of result.Parameters!) {
        let name = parameter.Name?.replace(path, '')
          .toUpperCase()
          .replace(/\//g, delimiter)
          .replace(/-/g, '_')
        name = `${prefix}${name}`
        params[name] = parameter.Value
        if (saveToEnvironment) {
          core.info(`Exporting variable ${name}`)
          core.exportVariable(name, parameter.Value)
        }
      }

      if (saveToEnvironment) {
        core.endGroup()
      }
    }

    const fileName = core.getInput('file', {required: false})
    core.info(fileName)
    if (fileName) {
      core.info(`Writing to file ${fileName}`)

      writeFileSync(
        fileName,
        Object.keys(params)
          .map(k => `${k}=${params[k]}`)
          .join('\n')
      )
    }

    core.setOutput('ssm-params', JSON.stringify(params))
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()