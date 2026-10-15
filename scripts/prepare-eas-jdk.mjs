import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

if (process.env.EAS_BUILD_PLATFORM !== 'android') {
  process.exit(0)
}

const javaHome = '/usr/lib/jvm/java-21-openjdk-amd64'
const javaExecutable = `${javaHome}/bin/java`

if (!existsSync(javaExecutable)) {
  execFileSync('sudo', ['apt-get', 'update'], { stdio: 'inherit' })
  execFileSync('sudo', ['apt-get', 'install', '-y', 'openjdk-21-jdk-headless'], { stdio: 'inherit' })
}

if (!existsSync(javaExecutable)) {
  throw new Error(`Java 21 was not installed at ${javaHome}`)
}

const gradlePropertiesPath = 'android/gradle.properties'
const gradleProperties = readFileSync(gradlePropertiesPath, 'utf8')
const javaHomeSetting = `org.gradle.java.home=${javaHome}`

if (/^org\.gradle\.java\.home=/m.test(gradleProperties)) {
  writeFileSync(gradlePropertiesPath, gradleProperties.replace(/^org\.gradle\.java\.home=.*$/m, javaHomeSetting))
} else {
  appendFileSync(gradlePropertiesPath, `\n${javaHomeSetting}\n`)
}