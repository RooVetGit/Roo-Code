import { makeStyles, shorthands, Title3, Text, Card, CardHeader } from "@fluentui/react-components"

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
  },
  card: {
    width: "100%",
  },
  section: {
    marginBottom: "24px",
  },
})

const PermissionsSettings = () => {
  const styles = useStyles()

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <Title3>Auto Approve Settings</Title3>
        <Text>Configure which operations are automatically approved.</Text>
        <Card className={styles.card}>
          <CardHeader header="Read Operations" />
          <div style={{ padding: "16px" }}>
            <Text>Read operation settings will be implemented here.</Text>
          </div>
        </Card>
      </div>

      <div className={styles.section}>
        <Title3>Write Operations</Title3>
        <Text>Configure write operation permissions.</Text>
        <Card className={styles.card}>
          <CardHeader header="Write Operations" />
          <div style={{ padding: "16px" }}>
            <Text>Write operation settings will be implemented here.</Text>
          </div>
        </Card>
      </div>

      <div className={styles.section}>
        <Title3>Execute Operations</Title3>
        <Text>Configure execute operation permissions.</Text>
        <Card className={styles.card}>
          <CardHeader header="Execute Operations" />
          <div style={{ padding: "16px" }}>
            <Text>Execute operation settings will be implemented here.</Text>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default PermissionsSettings
